import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { isFullBlock } from "@notionhq/client";
import { DS, EXAMS, GRAMMAR_ORDER, LESSON_AUDIO_PAGE, TEXTBOOK_INDEX_PARENTS, N3_BATCH_SIZE, N3_DUE_LIMIT, QUIZ_DAILY_LIMIT, TZ, W3_PARENT_PAGE } from "./config";
import { addDays, diffDays, formatJP, isWeekend, todayISO } from "./dates";
import { gradeWithAi } from "./ai";
import { groupBySection, sectionTitle, type IndexSection } from "./lessonOrder";
import { parseDetail, type N3Detail } from "./n3Detail";
import { autoGrade, gradeChoice, parseChoices } from "./grading";
import { MOCK_NOTE_ID, mockAnswer, mockHistory, mockN3Detail, mockJournal, mockReview, mockToday, mockVocab } from "./mock";
import { byTime, eventsOnDay, nextEventDay, type CalendarEvent } from "./calendar";
import { GROUP_OF, VERB_CLASSES, conjugate, formsFor, parseVerb, type Verb, type VerbClass, type VerbForm } from "./conjugate";
import { VOA_BASE, VOA_FEEDS, parseVoaArticle, parseVoaFeed, type VoaArticle, type VoaFeedKey, type VoaItem } from "./voa";
import { TADOKU_URL, parseTadoku, parseTadokuBook, type TadokuBook, type TadokuDetail } from "./tadoku";
import { audioKey, lessonRows, lessonTitle, parseIndexPage, parseTranscript, type AudioRow, type IndexBlock, type TranscriptPart } from "./lessonAudio";
import { parseNoteGrammar, type GrammarPoint, type NoteBlock, type Seg } from "./noteGrammar";
import { EN_OTHER, EN_TOPICS } from "./reviewSource";
import { findChildPages } from "./childPages";
import { bookOf, lessonNo, parseAnswers, type Book, type SpeakingSet } from "./speaking";
import { AUDIO_PROPERTY, currentAudio, type AudioSource, type CurrentAudio } from "./jaAudioFiles";
import { NOTE_REVIEW_OPTIONS } from "./noteReview";
import { tedDoneChange } from "./tedLog";
import { dayStats, monthEnd, shiftMonth, streak, type DayStat } from "./history";
import { autoKind, quarterMonths, quarterOf, type AutoKind, type Quarter } from "./goals";
import { EVIU_STATUSES, eviuProgress, type EviuUnit } from "./eviu";
import { grammarOn, n3WordsOn, needsDebtCheck, reviewParts, stageFor } from "./stages";
import { pickPreviewPage, summarizePreview, type ChildPage, type SimpleBlock } from "./preview";
import { date, files, getPage, hasNotion, multiSelect, notion, num, numOrNull, queryAll, relationIds, select, text, updatePage, w, type Page } from "./notion";
import {
  firstUnlearnedGrammar,
  matchGrammar,
  n3Progress,
  n3NextLevel,
  quizUpdate,
  vocabUpdate,
  weekGrammar,
  type GrammarRow,
} from "./srs";
import type {
  AnswerPayload,
  Link,
  GradeResult,
  GrammarItem,
  N3WordItem,
  QuizItem,
  ReviewItem,
  ReviewSource,
  TodayData,
  KanjiItem,
  VerbItem,
  VocabItem,
} from "./types";

const useMock = () => !hasNotion() && process.env.MOCK === "1";

export function today(): string {
  return process.env.MOCK_TODAY ?? todayISO(TZ);
}

// ── 讀取 ──────────────────────────────────────────

// 題庫積壓可能上百題（2026-10-26 有 777 題到期），所以先只拿 ❌／未作答，不夠 20 題才補 ✅ 對過的。
// 每天最多 QUIZ_DAILY_LIMIT 題：今天已經答過的先扣掉，答完 20 題就不再出。
const QUIZ_DUE = (day: string) => ({ property: "下次複習", date: { on_or_before: day } });
const QUIZ_SORTS = [{ property: "下次複習", direction: "ascending" as const }];
const QUIZ_WEAK = {
  or: [
    { property: "上次結果", select: { does_not_equal: "✅ 對" } },
    { property: "上次結果", select: { is_empty: true as const } },
  ],
};
const notTestedToday = (day: string) => (pages: Page[]) => pages.filter((p) => date(p, "上次測驗") !== day);

/** 到期的 ❌／未作答（階段 2 的「題庫錯題」；也用來判斷積壓清空沒） */
async function quizWeakDue(day: string, limit: number): Promise<Page[]> {
  if (limit <= 0) return [];
  return notTestedToday(day)(await queryAll(DS.quiz, { and: [QUIZ_DUE(day), QUIZ_WEAK] }, QUIZ_SORTS, limit));
}

async function quizLeftToday(day: string): Promise<number> {
  const done = await queryAll(DS.quiz, { property: "上次測驗", date: { equals: day } }, undefined, QUIZ_DAILY_LIMIT);
  return Math.max(QUIZ_DAILY_LIMIT - done.length, 0);
}

/** 到期題：❌／未作答優先，不夠再補 ✅ 對過的 */
async function quizDue(day: string): Promise<Page[]> {
  const left = await quizLeftToday(day);
  const urgent = await quizWeakDue(day, left);
  if (urgent.length >= left) return urgent.slice(0, left);
  const rest = notTestedToday(day)(
    await queryAll(DS.quiz, { and: [QUIZ_DUE(day), { property: "上次結果", select: { equals: "✅ 對" } }] }, QUIZ_SORTS, left),
  );
  return [...urgent, ...rest].slice(0, left);
}

/** 寒假清債：只出 ❌ 和未作答，每天 20 題 */
async function quizDebt(day: string): Promise<Page[]> {
  return quizWeakDue(day, await quizLeftToday(day));
}

/** 這天出不出新的 N3 單字：寒假清債要等題庫積壓（到期的 ❌／未作答）清空，或到 1/1 */
async function n3WordsActive(day: string): Promise<boolean> {
  const stage = stageFor(day);
  if (useMock() || !needsDebtCheck(stage, day)) return n3WordsOn(stage, day, false);
  return n3WordsOn(stage, day, (await quizWeakDue(day, 5)).length === 0);
}

const N3_LEVEL_FILTER = {
  or: [
    { property: "JLPT Level", select: { equals: "N3" } },
    { property: "JLPT Level", select: { equals: "N2+" } },
  ],
};

// N3 文法補強只有 52 筆、很少變：快取一小時，複習答題改了熟悉度就清掉
const cachedGrammarAll = unstable_cache(() => queryAll(DS.n3Grammar), ["n3-grammar-all"], { revalidate: 3600, tags: ["n3-grammar"] });

// N3／N2+ 字的編號（排序好）：算「已學幾個／剩幾個」用
const cachedN3Numbers = unstable_cache(
  async () =>
    (await queryAll(DS.n3Words, N3_LEVEL_FILTER, [{ property: "編號 / 번호", direction: "ascending" }], 5000))
      .map((p) => num(p, "編號 / 번호"))
      .filter((n) => n > 0),
  ["n3-numbers"],
  { revalidate: 86400 },
);

// 熟悉度_K 沒填（大部分的字）也算未學
const N3_UNLEARNED = {
  or: [
    { property: "熟悉度_K", status: { equals: "未學" } },
    { property: "熟悉度_K", status: { is_empty: true as const } },
  ],
};

/**
 * 編號 after 以後、未學的前 25 個字的編號範圍。key 含日期：每天第一次算的結果固定到當天結束，
 * 不然一答題熟悉度就變了，批次會一直往後換。after＝-1 是今天的批次，after＝今天最後一個編號是下一批預覽。
 */
const cachedN3BatchRange = unstable_cache(
  async (_day: string, after: number): Promise<{ lo: number; hi: number } | null> => {
    const nos = (
      await queryAll(
        DS.n3Words,
        { and: [N3_LEVEL_FILTER, N3_UNLEARNED, { property: "編號 / 번호", number: { greater_than: after } }] },
        [{ property: "編號 / 번호", direction: "ascending" }],
        N3_BATCH_SIZE,
      )
    )
      .slice(0, N3_BATCH_SIZE)
      .map((p) => num(p, "編號 / 번호"));
    return nos.length ? { lo: nos[0], hi: nos[nos.length - 1] } : null;
  },
  ["n3-batch-range-v2"],
  { revalidate: 2 * 86400 },
);

/** 編號範圍內的字（每次重讀，熟悉度、上次複習才是最新的） */
const n3Range = (r: { lo: number; hi: number }) =>
  queryAll(
    DS.n3Words,
    {
      and: [
        { property: "編號 / 번호", number: { greater_than_or_equal_to: r.lo } },
        { property: "編號 / 번호", number: { less_than_or_equal_to: r.hi } },
        N3_LEVEL_FILTER,
      ],
    },
    [{ property: "編號 / 번호", direction: "ascending" }],
  );

/** 今天的 N3 新字（這個階段不出新字就是空的） */
async function n3Batch(day: string): Promise<Page[]> {
  if (!(await n3WordsActive(day))) return [];
  const range = await cachedN3BatchRange(day, -1);
  return range ? n3Range(range) : [];
}

async function n3Due(day: string): Promise<Page[]> {
  return queryAll(
    DS.n3Words,
    {
      and: [
        { property: "下次複習_K", formula: { date: { on_or_before: day } } },
        { property: "熟悉度_K", status: { does_not_equal: "未學" } },
        N3_LEVEL_FILTER,
      ],
    },
    [{ property: "下次複習_K", direction: "ascending" }],
  );
}

const grammarRow = (p: Page): GrammarRow => ({
  title: text(p, "文型 / 문형"),
  status: grammarBase(select(p, "熟悉度 / 숙련도")),
  last: date(p, "上次複習 / 지난 복습"),
});

/**
 * 平日的新文型：GRAMMAR_ORDER 裡第一個還沒學過的。key 含日期：每天第一次算的結果固定到當天結束，
 * 不然一答題熟悉度變了，今天的文型就跳到下一個。
 */
const cachedTodayGrammar = unstable_cache(
  async (_day: string): Promise<string | null> => firstUnlearnedGrammar(GRAMMAR_ORDER, (await queryAll(DS.n3Grammar)).map(grammarRow)),
  ["n3-grammar-today-v1"],
  { revalidate: 2 * 86400 },
);

/** 今天的文型：這個階段有新文型才有；平日 1 個，週末複習這週學過的 */
async function todaysGrammarNames(day: string): Promise<string[]> {
  if (!grammarOn(stageFor(day), day)) return [];
  if (isWeekend(day)) return weekGrammar(GRAMMAR_ORDER, (await cachedGrammarAll()).map(grammarRow), day);
  const name = await cachedTodayGrammar(day);
  return name ? [name] : [];
}

const grammarBase = (s: string | null) => (s ? s.split(" / ")[0] : null);

async function grammarForReview(day: string): Promise<Page[]> {
  const all = await cachedGrammarAll();
  const names = await todaysGrammarNames(day);
  const picked = all.filter(
    (p) =>
      names.some((n) => matchGrammar(n, text(p, "文型 / 문형"))) || grammarBase(select(p, "熟悉度 / 숙련도")) === "忘記",
  );
  return picked.filter((p) => date(p, "上次複習 / 지난 복습") !== day);
}

const toQuiz = (p: Page): QuizItem => ({
  kind: "quiz",
  id: p.id,
  prompt: text(p, "題目"),
  qtype: select(p, "題型"),
  answer: text(p, "正確答案"),
  explanation: text(p, "解析"),
  lastResult: select(p, "上次結果"),
  myAnswer: text(p, "我的答案"),
  lastTested: date(p, "上次測驗"),
});

const toN3 = (p: Page, source: "batch" | "due"): N3WordItem => ({
  kind: "n3",
  id: p.id,
  word: text(p, "單字 / 단어"),
  reading: text(p, "讀音 / 요미가나"),
  meaning: text(p, "中文"),
  pos: select(p, "詞性 / 품사")?.split(" / ")[0] ?? null,
  note: text(p, "備註 / 비고"),
  level: select(p, "JLPT Level"),
  status: select(p, "熟悉度_K"),
  source,
});

const toGrammar = (p: Page): GrammarItem => ({
  kind: "grammar",
  id: p.id,
  pattern: text(p, "文型 / 문형"),
  meaning: text(p, "中文説明 / 중국어 뜻"),
  connection: text(p, "接續 / 접속"),
  confusable: text(p, "易混淆組 / 비교"),
  status: grammarBase(select(p, "熟悉度 / 숙련도")),
});

/**
 * 今晚複習，依學習階段：
 * 期末衝刺＝只有題庫到期題；寒假清債＝只有題庫的 ❌／未作答（N3 單字開始後再加 N3）；
 * 1 月期以後＝題庫到期題 → N3 到期字 → 今日批次 25 個 → 文型。
 */
export async function getReviewQueue(): Promise<ReviewItem[]> {
  const day = today();
  const stage = stageFor(day);
  if (useMock()) {
    const parts = reviewParts(stage, false);
    return mockReview().filter((i) => i.kind === "quiz" || (i.kind === "n3" ? parts.n3 : parts.grammar));
  }
  const quizP = stage.quiz === "debt" ? quizDebt(day) : quizDue(day);
  const parts = reviewParts(stage, stage.n3Review || (await n3WordsActive(day)));
  const [quiz, batch, due, grammar] = await Promise.all([
    quizP,
    parts.n3 ? n3Batch(day) : ([] as Page[]),
    parts.n3 ? n3Due(day) : ([] as Page[]),
    parts.grammar ? grammarForReview(day) : ([] as Page[]),
  ]);
  const dueItems = due.slice(0, N3_DUE_LIMIT).map((p) => toN3(p, "due"));
  const dueIds = new Set(dueItems.map((i) => i.id));
  // 今日批次全部考：考過熟悉度才會離開「未學」，沒考的隔天還會排在批次最前面
  const batchItems = batch.filter((p) => !dueIds.has(p.id) && date(p, "上次複習_K") !== day).map((p) => toN3(p, "batch"));
  return [...quiz.map(toQuiz), ...dueItems, ...batchItems, ...grammar.map(toGrammar)];
}

export type N3BatchView = {
  /** 這個階段（這天）有沒有出新字 */
  active: boolean;
  words: N3WordItem[];
  grammar: GrammarItem[];
  progress: { learned: number; total: number; left: number; days: number };
};

/** /n3：今天的 N3 新字（唯讀）；next＝預覽下一批 25 個（還沒開始出新字時就是第一批） */
export async function getN3Batch(next = false): Promise<N3BatchView> {
  const day = today();
  if (useMock()) {
    const items = mockReview();
    const active = await n3WordsActive(day);
    return {
      active,
      words: items.filter((i): i is N3WordItem => i.kind === "n3"),
      grammar: next || !active ? [] : items.filter((i): i is GrammarItem => i.kind === "grammar"),
      progress: n3Progress([18, 19, 28, 42], 18, N3_BATCH_SIZE),
    };
  }
  const active = await n3WordsActive(day);
  const [nos, todayRange, grammarAll] = await Promise.all([cachedN3Numbers(), cachedN3BatchRange(day, -1), cachedGrammarAll()]);
  const progress = n3Progress(nos, todayRange?.lo ?? null, N3_BATCH_SIZE);
  // 還沒開始出新字：「下一批」就是第一批
  const range = next && active ? (todayRange ? await cachedN3BatchRange(day, todayRange.hi) : null) : todayRange;
  const words = range ? (await n3Range(range)).map((p) => toN3(p, "batch")) : [];
  const names = next ? [] : await todaysGrammarNames(day);
  return {
    active,
    words,
    grammar: grammarAll.filter((p) => names.some((name) => matchGrammar(name, text(p, "文型 / 문형")))).map(toGrammar),
    progress,
  };
}

/** N3 單字／文型、漢字的詳解：只讀 Notion 頁內文的「📘 詳解」（由 Notion AI 寫好；App 不產生，省 API 費用）；沒有就回傳 null */
export async function getN3Detail(id: string): Promise<N3Detail | null> {
  if (useMock()) return mockN3Detail(id);
  const page = await getPage(id);
  const source = page.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (![DS.n3Words, DS.n3Grammar, DS.kanji].some((ds) => ds.replace(/-/g, "") === source)) throw new Error("不是 N3 單字、文型或漢字的頁面");
  return parseDetail((await allChildren(id)).map((b) => ({ type: b.type, text: richText(b) })));
}

// ── 題庫練習／單字測驗（複習頁的篩選入口）──────────────────

const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 課堂筆記的「課次」是「L3」「L12 ST1/ST2」「L14残り・L15 ST1」這種文字，取開頭的課號 */
const noteLesson = (s: string): number | null => {
  const m = s.match(/^L(\d+)/);
  return m ? Number(m[1]) : null;
};

async function lessonNoteIds(level: string | null, lessons: number[]): Promise<string[]> {
  const notes = await queryAll(DS.isiNotes, level ? { property: "レベル", select: { equals: level } } : undefined);
  return notes.filter((p) => lessons.includes(noteLesson(text(p, "課次")) ?? -1)).map((p) => p.id);
}

async function bankQuiz(s: Extract<ReviewSource, { src: "bank" }>): Promise<QuizItem[]> {
  const and: object[] = [];
  if (s.lessons.length) {
    const ids = await lessonNoteIds(s.level, s.lessons);
    if (!ids.length) return [];
    and.push({ or: ids.map((id) => ({ property: "來源課堂", relation: { contains: id } })) });
  } else if (s.level) and.push({ property: "レベル", select: { equals: s.level } });
  if (s.qtype) and.push({ property: "題型", select: { equals: s.qtype } });
  if (s.scope === "weak")
    and.push({
      or: [
        { property: "上次結果", select: { does_not_equal: "✅ 對" } },
        { property: "上次結果", select: { is_empty: true } },
      ],
    });
  const pages = await queryAll(DS.quiz, and.length ? ({ and } as never) : undefined, undefined, 400);
  // 錯過的優先，其餘隨機
  const items = shuffle(pages.map(toQuiz));
  const rank = (q: QuizItem) => (q.lastResult === "❌ 錯" ? 0 : q.lastResult === "✅ 對" ? 2 : 1);
  return items.sort((a, b) => rank(a) - rank(b)).slice(0, s.count);
}

const audioSource = (p: Page): AudioSource => ({
  word: text(p, "單字"),
  reading: text(p, "音標/假名"),
  pitch: numOrNull(p, "聲調"),
  ex1: text(p, "例句"),
  ex2: text(p, "例句2"),
  usage: text(p, "搭配・用法"),
});

/** 日文單字還是最新的發音檔（內容改過的就不用，退回瀏覽器發音） */
const vocabAudio = (p: Page): CurrentAudio => (select(p, "語言") === "🇯🇵 日文" ? currentAudio(p.id, audioSource(p), files(p, AUDIO_PROPERTY)) : {});

/** /api/vocab-audio/[id]/[kind]：發音檔當下有效的網址（頁面上的網址一小時後失效時才會走到這裡） */
/** kind：w、e1、e2，或搭配的「u-內容雜湊」 */
export async function vocabAudioUrl(id: string, kind: string): Promise<string | null> {
  if (useMock()) return null;
  const p = await getPage(id);
  const source = p.parent.type === "data_source_id" ? p.parent.data_source_id.replace(/-/g, "") : "";
  if (source !== DS.vocab.replace(/-/g, "")) return null;
  const audio = vocabAudio(p);
  if (kind.startsWith("u-")) return Object.values(audio.u ?? {}).find((a) => a.fallback.endsWith(`/${kind}`))?.url ?? null;
  return kind === "w" || kind === "e1" || kind === "e2" ? (audio[kind]?.url ?? null) : null;
}

const toVocab = (p: Page): VocabItem => {
  const audio = vocabAudio(p);
  return {
  kind: "vocab",
  id: p.id,
  word: text(p, "單字"),
  reading: text(p, "音標/假名"),
  meaning: text(p, "中文翻譯"),
  pos: select(p, "詞性"),
  usage: text(p, "搭配・用法"),
  examples: [
    { ja: text(p, "例句"), zh: text(p, "例句翻譯"), audio: audio.e1 },
    { ja: text(p, "例句2"), zh: text(p, "例句2翻譯"), audio: audio.e2 },
  ].filter((e) => e.ja),
  audio: audio.w,
  usageAudio: audio.u,
  lesson: select(p, "課次"),
  lang: select(p, "語言") === "🇬🇧 英文" ? "en" : "ja",
  status: select(p, "熟悉度"),
  right: num(p, "答對次數"),
  wrong: num(p, "答錯次數"),
  };
};

const VOCAB_RANK: Record<string, number> = { 忘記: 0, 學習中: 1, 未學: 2, 熟悉: 3, 精通: 4 };

const ENGLISH_NOT_MASTERED = {
  and: [{ property: "語言", select: { equals: "🇬🇧 英文" } }, { property: "熟悉度", status: { does_not_equal: "精通" } }],
};

async function vocabQuiz(s: Extract<ReviewSource, { src: "vocab" }>): Promise<VocabItem[]> {
  const and: object[] = [{ property: "語言", select: { equals: s.lang === "en" ? "🇬🇧 英文" : "🇯🇵 日文" } }];
  if (s.lang === "ja" && s.level) {
    const lessons = s.lessons.length ? s.lessons : Array.from({ length: 15 }, (_, i) => i + 1);
    and.push({ or: lessons.map((n) => ({ property: "課次", select: { equals: `${s.level} L${n}` } })) });
  }
  if (s.lang === "en") and.push(...englishFilter(s.cefr, s.topic), { property: "熟悉度", status: { does_not_equal: "精通" } });
  const pages = await queryAll(DS.vocab, { and } as never, undefined, 1000);
  let items = pages.map(toVocab);
  // 只練課本的某一小節（ST1／ST2／補…）
  if (s.section && s.level && s.lessons.length === 1) {
    const groups = groupBySection(items, await cachedLessonSections(s.level, s.lessons[0]).catch(() => [] as IndexSection[]));
    items = groups.find((g) => g.title === s.section)?.words ?? [];
  }
  // 忘記 → 學習中 → 未學 → 熟悉 → 精通，同一級隨機
  return shuffle(items)
    .sort((a, b) => (VOCAB_RANK[a.status ?? "未學"] ?? 2) - (VOCAB_RANK[b.status ?? "未學"] ?? 2))
    .slice(0, s.count);
}

/** /api/review：依出題來源取題 */
export async function getReviewItems(s: ReviewSource): Promise<ReviewItem[]> {
  if (s.src === "due") return getReviewQueue();
  if (s.src === "mistakes") return (await getMistakes()).slice(0, 30);
  if (s.src === "verb") return verbQuiz(s);
  if (s.src === "kanji") return kanjiQuiz(s);
  if (useMock()) return s.src === "vocab" ? mockVocab() : mockReview().filter((i) => i.kind === "quiz");
  return s.src === "bank" ? bankQuiz(s) : vocabQuiz(s);
}

// ── 漢字 ────────────────────────────────────────────

const toKanji = (p: Page): KanjiItem => ({
  kind: "kanji",
  id: p.id,
  kanji: text(p, "漢字"),
  on: text(p, "音読み"),
  kun: text(p, "訓読み"),
  meaning: text(p, "中文意思"),
  examples: text(p, "例詞")
    .split("\n")
    .map((l) => l.split("｜").map((x) => x.trim()))
    .filter((x) => x[0] && x.length >= 2)
    .map(([word, reading, zh = ""]) => ({ word, reading, zh })),
  hint: text(p, "字形提示"),
  confusable: text(p, "易混淆"),
  chapter: select(p, "章"),
  status: select(p, "熟悉度"),
});

const MOCK_KANJI: KanjiItem[] = [
  {
    kind: "kanji",
    id: "k1",
    kanji: "体",
    on: "タイ",
    kun: "からだ",
    meaning: "身體",
    examples: [
      { word: "体", reading: "からだ", zh: "身體" },
      { word: "体重", reading: "たいじゅう", zh: "體重" },
    ],
    hint: "字形和「休」很像",
    confusable: "体⇄休",
    chapter: "HSJⅡ 1章",
    status: "未學",
  },
  {
    kind: "kanji",
    id: "k2",
    kanji: "歌",
    on: "カ",
    kun: "うた・うた.う",
    meaning: "歌；唱",
    examples: [{ word: "歌手", reading: "かしゅ", zh: "歌手" }],
    hint: "",
    confusable: "",
    chapter: "HSJⅡ 2章",
    status: "學習中",
  },
];

/** 某幾章的漢字（依建立順序＝課本順序） */
export async function getKanji(chapters: string[]): Promise<KanjiItem[]> {
  if (useMock()) return MOCK_KANJI.filter((k) => !chapters.length || chapters.includes(k.chapter ?? ""));
  const pages = await queryAll(
    DS.kanji,
    chapters.length ? ({ or: chapters.map((c) => ({ property: "章", select: { equals: c } })) } as never) : undefined,
    [{ timestamp: "created_time", direction: "ascending" }],
    2000,
  );
  return pages.map(toKanji);
}

/** 漢字表與選章畫面：每章幾個字 */
export async function kanjiChapterCounts(): Promise<Record<string, number>> {
  if (useMock()) return { "HSJⅡ 1章": 12, "HSJⅡ 2章": 12, "HSJⅠ 9章": 8 };
  const counts: Record<string, number> = {};
  for (const k of await getKanji([])) if (k.chapter) counts[k.chapter] = (counts[k.chapter] ?? 0) + 1;
  return counts;
}

async function kanjiQuiz(s: Extract<ReviewSource, { src: "kanji" }>): Promise<KanjiItem[]> {
  const all = await getKanji(s.chapters);
  return shuffle(all)
    .sort((a, b) => (VOCAB_RANK[a.status ?? "未學"] ?? 2) - (VOCAB_RANK[b.status ?? "未學"] ?? 2))
    .slice(0, s.count);
}

// ── 動詞の形 ───────────────────────────────────────────

/** 單字庫裡的動詞（同一個辭書形只留一筆）；只讀四個欄位，快取一小時 */
const cachedVerbs = unstable_cache(
  async (): Promise<Verb[]> => {
    const pages = await queryAll(
      DS.vocab,
      { or: VERB_CLASSES.map((c) => ({ property: "日文活用", select: { equals: c } })) } as never,
      undefined,
      2000,
    );
    const seen = new Map<string, Verb>();
    for (const p of pages) {
      const parsed = parseVerb(text(p, "單字"), text(p, "音標/假名"), select(p, "日文活用") as VerbClass);
      if (!parsed) continue;
      // 同一個辭書形只留一筆（有中文翻譯的優先）；掛ける／かける（電話を）這種寫法不同的分開
      const key = parsed.dict + parsed.reading + parsed.cls;
      const prev = seen.get(key);
      const meaning = text(p, "中文翻譯");
      const potential = /可能形/.test(text(p, "備註"));
      if (!prev || (!prev.meaning && meaning)) seen.set(key, { id: p.id, ...parsed, meaning, potential });
    }
    return [...seen.values()];
  },
  ["verbs"],
  { revalidate: 3600 },
);

export async function getVerbs(): Promise<Verb[]> {
  if (useMock())
    return [
      { id: "v-kaku", dict: "書く", reading: "かく", cls: "五段", meaning: "寫" },
      { id: "v-kaeru", dict: "帰る", reading: "かえる", cls: "五段", meaning: "回去" },
      { id: "v-iku", dict: "行く", reading: "いく", cls: "五段", meaning: "去" },
      { id: "v-taberu", dict: "食べる", reading: "たべる", cls: "一段", meaning: "吃" },
      { id: "v-miru", dict: "見る", reading: "みる", cls: "一段", meaning: "看" },
      { id: "v-okiru", dict: "起きる", reading: "おきる", cls: "一段", meaning: "起床" },
      { id: "v-hairu", dict: "入る", reading: "はいる", cls: "五段", meaning: "進入" },
      { id: "v-kau", dict: "買う", reading: "かう", cls: "五段", meaning: "買" },
      { id: "v-benkyou", dict: "勉強する", reading: "べんきょうする", cls: "サ変", meaning: "唸書" },
      { id: "v-kuru", dict: "来る", reading: "くる", cls: "カ変", meaning: "來" },
    ];
  return cachedVerbs();
}

async function verbQuiz(s: Extract<ReviewSource, { src: "verb" }>): Promise<VerbItem[]> {
  const verbs = (await getVerbs()).filter((v) => !s.groups.length || s.groups.includes(GROUP_OF[v.cls]));
  const forms = s.forms as VerbForm[];
  const items: VerbItem[] = [];
  for (const v of shuffle(verbs)) {
    if (items.length >= s.count) break;
    // 開了「判斷類別」時，大約每 4 題出 1 題判斷
    if (s.judge && items.length % 4 === 3) {
      items.push({ kind: "verb", id: `${v.id}:group`, dict: v.dict, reading: v.reading, meaning: v.meaning, cls: v.cls, mode: "group", form: "group", answer: { word: GROUP_OF[v.cls], reading: GROUP_OF[v.cls] } });
      continue;
    }
    const usable = formsFor(v, forms);
    if (!usable.length) continue;
    const form = usable[Math.floor(Math.random() * usable.length)];
    const answer = conjugate(v, form);
    if (!answer) continue;
    items.push({ kind: "verb", id: `${v.id}:${form}`, dict: v.dict, reading: v.reading, meaning: v.meaning, cls: v.cls, mode: "conj", form, answer });
  }
  return items;
}

/** 單字測驗選課畫面：每課有幾個字 */
// 要讀上千筆，快取一小時
const cachedVocabLessonStats = unstable_cache(
  async () => {
    const pages = await queryAll(
      DS.vocab,
      { and: [{ property: "課次", select: { is_not_empty: true } }, { property: "課次", select: { does_not_equal: "未分類" } }] } as never,
      undefined,
      5000,
    );
    // 課次 → 熟悉度 → 字數（沒填熟悉度算未學）
    const stats: Record<string, Record<string, number>> = {};
    for (const p of pages) {
      const l = select(p, "課次");
      if (!l) continue;
      const st = select(p, "熟悉度") ?? "未學";
      (stats[l] ??= {})[st] = (stats[l][st] ?? 0) + 1;
    }
    return stats;
  },
  ["vocab-lesson-stats"],
  { revalidate: 3600 },
);

export const FAMILIARITY = ["未學", "忘記", "學習中", "熟悉", "精通"] as const;

/** 每一課各熟悉度的字數（日文首頁的課次色條） */
export async function vocabLessonStats(): Promise<Record<string, Record<string, number>>> {
  if (useMock())
    return {
      "初級 L1": { 熟悉: 10, 精通: 21 },
      "初級 L2": { 學習中: 30, 熟悉: 27, 精通: 20 },
      "初中級 L1": { 未學: 4, 忘記: 2, 學習中: 9, 熟悉: 10, 精通: 8 },
      "初中級 L2": { 未學: 20, 忘記: 5, 學習中: 20, 熟悉: 10 },
      "初中級 L3": { 未學: 30, 忘記: 3, 學習中: 15, 熟悉: 7, 精通: 3 },
    };
  return cachedVocabLessonStats();
}

export async function vocabLessonCounts(): Promise<Record<string, number>> {
  const stats = await vocabLessonStats();
  return Object.fromEntries(Object.entries(stats).map(([l, st]) => [l, Object.values(st).reduce((a, b) => a + b, 0)]));
}

export async function englishVocabCount(): Promise<number> {
  if (useMock()) return 12;
  return (await queryAll(DS.vocab, ENGLISH_NOT_MASTERED as never, undefined, 1000)).length;
}

// ── 英文單字卡：CEFR → 主題 ──────────────────────────────

/** 主題有好幾個時用第一個認得的；沒有就歸「其他」 */
const enTopic = (p: Page) => multiSelect(p, "主題").find((t) => (EN_TOPICS as readonly string[]).includes(t)) ?? EN_OTHER;

function englishFilter(cefr?: string, topic?: string): object[] {
  const f: object[] = [];
  if (cefr) f.push({ property: "CEFR", select: { equals: cefr } });
  if (topic === EN_OTHER) f.push(...EN_TOPICS.map((t) => ({ property: "主題", multi_select: { does_not_contain: t } })));
  else if (topic) f.push({ property: "主題", multi_select: { contains: topic } });
  return f;
}

/** 某一級的英文單字，依主題分組（主題順序固定，組內依加入順序） */
export async function getEnglishVocab(cefr: string): Promise<{ title: string; words: VocabItem[] }[]> {
  if (useMock()) return [{ title: "日常", words: mockVocab() }];
  const pages = await queryAll(
    DS.vocab,
    { and: [{ property: "語言", select: { equals: "🇬🇧 英文" } }, ...englishFilter(cefr)] } as never,
    [{ timestamp: "created_time", direction: "ascending" }],
    2000,
  );
  return [...EN_TOPICS, EN_OTHER]
    .map((title) => ({ title, words: pages.filter((p) => enTopic(p) === title).map(toVocab) }))
    .filter((g) => g.words.length);
}

/** 英文單字卡入口：每級幾個字 */
export async function englishLevelCounts(): Promise<Record<string, number>> {
  if (useMock()) return { B1: 12, B2: 5 };
  const pages = await queryAll(DS.vocab, { property: "語言", select: { equals: "🇬🇧 英文" } } as never, undefined, 3000);
  const out: Record<string, number> = {};
  for (const p of pages) {
    const c = select(p, "CEFR");
    if (c) out[c] = (out[c] ?? 0) + 1;
  }
  return out;
}

/** 日文分頁：某一課的單字（依加入順序＝課本順序） */
// 課本索引頁（初中級：「初中級課本索引｜L〇 …」；初級：「課本索引｜L〇 …」），在兩個課程頁的 toggle 裡
const cachedLessonIndexPages = unstable_cache(
  async () => textbookIndexPages((t) => /課本索引｜L\d/.test(t)),
  ["lesson-index-pages-v2"],
  { revalidate: 86400 },
);

/** 課本索引「📒 單字表」：每個 ### 小節底下表格的「單字」欄，依序 */
const cachedLessonSections = unstable_cache(
  async (level: string, lesson: number): Promise<IndexSection[]> => {
    const prefix = level === "初中級" ? "初中級課本索引" : "課本索引";
    const page = (await cachedLessonIndexPages()).find((p) => p.title.replace(/^\S*?(?=初中級課本索引|課本索引)/, "").startsWith(`${prefix}｜L${lesson} `));
    if (!page) return [];
    const blocks = await allChildren(page.id);
    const start = blocks.findIndex((b) => b.type === "heading_2" && richText(b).includes("單字表"));
    if (start < 0) return [];
    const sections: IndexSection[] = [];
    for (const b of blocks.slice(start + 1)) {
      if (b.type === "heading_2" || b.type === "heading_1") break;
      if (b.type === "heading_3") sections.push({ title: sectionTitle(richText(b)), words: [] });
      if (b.type !== "table") continue;
      const rows = (await allChildren(b.id)).flatMap((r) => (r.type === "table_row" ? [r.table_row.cells.map((c) => c.map((t) => t.plain_text).join("").trim())] : []));
      const col = rows[0]?.indexOf("單字") ?? -1;
      if (col < 0) continue;
      if (!sections.length) sections.push({ title: "", words: [] });
      sections.at(-1)!.words.push(...rows.slice(1).map((r) => r[col]).filter(Boolean));
    }
    return sections.filter((s) => s.words.length);
  },
  ["lesson-vocab-sections"],
  { revalidate: 86400 },
);

/** 一課的單字，照課本索引的順序分段（ST1／ST2／補…；表裡沒有的放最後） */
export async function getLessonVocab(level: string, lesson: number): Promise<{ title: string; words: VocabItem[] }[]> {
  if (useMock()) return groupBySection(mockVocab(), mockVocab().map((w, i) => ({ title: i ? "1-2 新しい友達" : "1-1 アルバイトを探す", words: [w.word] })));
  const [pages, sections] = await Promise.all([
    queryAll(
      DS.vocab,
      { and: [{ property: "語言", select: { equals: "🇯🇵 日文" } }, { property: "課次", select: { equals: `${level} L${lesson}` } }] } as never,
      [{ timestamp: "created_time", direction: "ascending" }],
      500,
    ),
    cachedLessonSections(level, lesson).catch(() => [] as IndexSection[]),
  ]);
  return groupBySection(pages.map(toVocab), sections);
}


/** 題庫練習選課畫面：課堂筆記有哪些課（題目都掛在課堂筆記上） */
export async function noteLessons(): Promise<Record<string, number[]>> {
  if (useMock()) return { 初級: Array.from({ length: 15 }, (_, i) => i + 1), 初中級: [1, 2, 3] };
  const notes = await queryAll(DS.isiNotes);
  const out: Record<string, Set<number>> = {};
  for (const p of notes) {
    const level = select(p, "レベル");
    const n = noteLesson(text(p, "課次"));
    if (level && n) (out[level] ??= new Set()).add(n);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
}

async function findPreviewPage(day: string) {
  const pages: ChildPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().blocks.children.list({ block_id: W3_PARENT_PAGE, start_cursor: cursor, page_size: 100 });
    for (const b of res.results) {
      if (isFullBlock(b) && b.type === "child_page") pages.push({ id: b.id, title: b.child_page.title, createdTime: b.created_time });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  const hit = pickPreviewPage(pages, day, TZ);
  if (!hit) return null;

  // 讀預習頁的第一層區塊，抓課次、考試預告、文法點
  const res = await notion().blocks.children.list({ block_id: hit.id, page_size: 100 });
  const plain = (rich: { plain_text: string }[]) => rich.map((r) => r.plain_text).join("").trim();
  const blocks: SimpleBlock[] = await Promise.all(
    res.results.filter(isFullBlock).map(async (b) => {
      if (b.type === "table") {
        // 文法整理常做成表格：讀出每一列的儲存格
        const rows = await notion().blocks.children.list({ block_id: b.id, page_size: 100 });
        return {
          type: "table",
          text: "",
          boldStart: false,
          rows: rows.results.filter(isFullBlock).flatMap((r) => (r.type === "table_row" ? [r.table_row.cells.map(plain)] : [])),
        };
      }
      const rich = (b as unknown as Record<string, { rich_text?: { plain_text: string; annotations: { bold: boolean } }[] }>)[b.type]
        ?.rich_text ?? [];
      return { type: b.type, text: rich.map((r) => r.plain_text).join(""), boldStart: Boolean(rich[0]?.annotations.bold) };
    }),
  );
  return { title: hit.title, url: `https://www.notion.so/${hit.id.replace(/-/g, "")}`, ...summarizePreview(blocks) };
}

/** 環境變數 ICAL_URLS：一個或多個 iCalendar 連結（空白或逗號分隔，webcal:// 也可以）。
 *  回傳今天的行程；今天沒有的話，再找 14 天內下一個有行程的日子。 */
async function calendarEvents(day: string): Promise<{ today: CalendarEvent[]; next: { date: string; events: CalendarEvent[] } | null } | null> {
  const urls = (process.env.ICAL_URLS ?? "").split(/[\s,]+/).filter(Boolean);
  if (!urls.length) return null;
  const icsList = await Promise.all(
    urls.map(async (u) => {
      const res = await fetch(u.replace(/^webcal:/i, "https:"), { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`行事曆讀取失敗（${res.status}）`);
      return res.text();
    }),
  );
  const todays = icsList.flatMap((ics) => eventsOnDay(ics, day, TZ)).sort(byTime);
  return { today: todays, next: todays.length ? null : nextEventDay(icsList, day, TZ) };
}

const TASK_AREAS = ["🇯🇵 Japanese", "📚 Learning"];
const TASK_OPEN_STATUSES = ["Queued", "Today", "In progress"];

/** 今日頁；day 給過去的日期＝從紀錄回看那天的內容 */
export async function getToday(day = today()): Promise<TodayData> {
  const past = day < today();
  if (useMock()) return { ...mockToday(day), past };

  const errors: string[] = [];
  // 每個區塊各自失敗，不讓一個沒分享的資料庫拖垮整頁
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}：${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  };
  const weekend = isWeekend(day);

  const [calendar, preview, homework, review, batch, grammarAll, notes, ted, books, pendingNotes, n3On, grammarNames, plannerTasks, plannerDone] = await Promise.all([
    safe("行事曆", () => calendarEvents(day), null),
    weekend ? null : safe("每日預習", () => findPreviewPage(day), null),
    safe(
      "作業",
      () =>
        queryAll(DS.isiNotes, {
          and: [
            { property: "作業截止", date: { on_or_after: day } },
            { property: "作業截止", date: { on_or_before: addDays(day, 7) } },
          ],
        }),
      [] as Page[],
    ),
    past ? ([] as ReviewItem[]) : safe("今晚複習", getReviewQueue, [] as ReviewItem[]),
    // 過去的日子讀不到那天的批次（批次只記當天），只顯示一列
    past ? ([] as Page[]) : safe("N3 單字", () => n3Batch(day), [] as Page[]),
    safe("N3 文法", cachedGrammarAll, [] as Page[]),
    safe("ISI 課堂筆記", () => queryAll(DS.isiNotes, { property: "日期", date: { equals: day } }), [] as Page[]),
    past
      ? ([] as Page[])
      : safe(
      "TED Log",
      async () => {
        const doing = await queryAll(DS.tedLog, { property: "進度", status: { equals: "今天做" } });
        if (doing.length) return doing;
        return queryAll(DS.tedLog, { property: "進度", status: { equals: "待做" } }, [
          { timestamp: "created_time", direction: "ascending" },
        ]);
      },
      [] as Page[],
    ),
    past ? ([] as Page[]) : safe("Books", () => queryAll(DS.books, { property: "Status", select: { equals: "Reading" } }), [] as Page[]),
    past ? ([] as ClassNoteLink[]) : safe("ISI 課堂筆記（未複習）", () => pendingClassNotes("初中級"), [] as ClassNoteLink[]),
    safe("N3 單字", () => n3WordsActive(day), false),
    // 過去的日子：今天的文型只記當天，回看不到
    past ? ([] as string[]) : safe("N3 文法", () => todaysGrammarNames(day), [] as string[]),
    // Life Planner 的 Tasks：日文／學習類、今天到期或逾期、還沒完成的
    past
      ? ([] as Page[])
      : safe(
          "Tasks",
          () =>
            queryAll(
              DS.tasks,
              {
                and: [
                  { or: TASK_AREAS.map((a) => ({ property: "Area", select: { equals: a } })) },
                  { property: "Due", date: { on_or_before: day } },
                  { property: "Status", status: { does_not_equal: "Done" } },
                  { property: "Status", status: { does_not_equal: "Cancelled" } },
                ],
              },
              [{ property: "Due", direction: "ascending" }],
              10,
            ),
          [] as Page[],
        ),
    // 今天打勾完成的也留著（可以取消）
    past
      ? ([] as Page[])
      : safe(
          "Tasks",
          () =>
            queryAll(DS.tasks, {
              and: [
                { or: TASK_AREAS.map((a) => ({ property: "Area", select: { equals: a } })) },
                { property: "Status", status: { equals: "Done" } },
                { property: "Completed at", date: { equals: day } },
              ],
            }),
          [] as Page[],
        ),
  ]);
  const tedPage = ted.find((p) => !text(p, "Talk").includes("模板"));
  const note = notes[0];

  return {
    date: day,
    dateLabel: formatJP(day),
    past,
    weekend,
    exams: EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 7),
    homework: homework
      .map((p) => ({ text: text(p, "作業"), due: date(p, "作業截止")!, url: p.url, daysLeft: diffDays(day, date(p, "作業截止")!) }))
      .filter((h) => h.text)
      .sort((a, b) => a.daysLeft - b.daysLeft),
    calendar: calendar?.today ?? null,
    nextCalendar: calendar?.next ?? null,
    preview,
    // 這個階段不出新字（期末衝刺）：不顯示那一列
    n3: n3On
      ? {
          count: past ? N3_BATCH_SIZE : batch.length,
          grammar: grammarNames.map((name) => ({
            name,
            url: grammarAll.find((p) => matchGrammar(name, text(p, "文型 / 문형")))?.url ?? null,
          })),
        }
      : null,
    classNote: note
      ? {
          id: note.id,
          review: select(note, "複習"),
          title: text(note, "課堂標題"),
          url: note.url,
          status: select(note, "狀態"),
          summary: text(note, "筆記摘要"),
          homework: text(note, "作業"),
        }
      : null,
    review: {
      quiz: review.filter((i) => i.kind === "quiz").length,
      n3: review.filter((i) => i.kind === "n3").length,
      grammar: review.filter((i) => i.kind === "grammar").length,
    },
    pendingNotes: pendingNotes.length ? { count: pendingNotes.length, oldest: pendingNotes[0].title } : null,
    ted: tedPage ? { title: text(tedPage, "Talk"), url: `/ted/${tedPage.id}`, progress: select(tedPage, "進度") } : null,
    books: books.map((p) => ({ title: text(p, "Name"), url: p.url, type: select(p, "Type") })),
    todos: [...plannerTasks, ...plannerDone].flatMap((p) => {
      const due = date(p, "Due");
      const status = select(p, "Status");
      return due || status === "Done"
        ? [{ id: p.id, title: text(p, "Name"), url: p.url, area: select(p, "Area"), daysLate: due ? diffDays(due, day) : 0, status }]
        : [];
    }),
    errors,
  };
}

// ── 寫回 ──────────────────────────────────────────

const GRAMMAR_LEVEL_FULL: Record<string, string> = {
  未學: "未學 / 안 배움",
  忘記: "忘記 / 잊음",
  學習中: "學習中 / 학습 중",
  熟悉: "熟悉 / 익숙함",
  精通: "精通 / 완벽",
};

/** 題庫題批改：先自動比對所有可接受的寫法，對不上才問 AI；AI 失敗會丟出原因，由 API route 轉成自評＋錯誤訊息。 */
export async function gradeQuiz(id: string, answer: string, choiceKey?: string): Promise<GradeResult> {
  const p = useMock() ? null : await getPage(id);
  const item = p ? toQuiz(p) : mockReview().find((i): i is QuizItem => i.kind === "quiz" && i.id === id);
  if (!item) throw new Error("找不到題目");
  // 選擇題：正確答案對得到選項就直接判定
  const choices = choiceKey ? parseChoices(item.prompt) : null;
  const picked = choices?.options.find((o) => o.key === choiceKey);
  if (choices && picked) {
    const r = gradeChoice(picked, choices.options, item.answer);
    if (r !== null) return { correct: r, method: "自動比對", feedback: "", suggestion: "" };
  }
  if (autoGrade(answer, item.answer)) return { correct: true, method: "自動比對", feedback: "", suggestion: "" };
  if (useMock()) return { correct: false, method: "AI", feedback: "（預覽）助詞用錯了：翻訳する的對象語言要用「に」。", suggestion: item.answer };
  const ai = await gradeWithAi({ question: item.prompt, reference: item.answer, explanation: item.explanation, answer });
  return { correct: ai.correct, method: "AI", feedback: ai.feedback, suggestion: ai.suggestion };
}

/** 單字・漢字・文型的記憶測驗：一律 AI 批改 */
export async function gradeRecall(question: string, reference: string, answer: string): Promise<GradeResult> {
  if (useMock()) {
    // 預覽：答案裡有參考答案的任一段就算對
    const ok = reference.split(/[／：]/).some((part) => part.trim().length > 1 && answer.includes(part.trim()));
    return { correct: ok, method: "AI", feedback: ok ? "（預覽）答對了。" : "（預覽）讀音或意思不對。", suggestion: ok ? "" : reference };
  }
  const ai = await gradeWithAi({ question, reference, explanation: "", answer, mode: "recall" });
  return { correct: ai.correct, method: "AI", feedback: ai.feedback, suggestion: ai.suggestion };
}

// 漢字庫沒有公式欄位，下次複習由 App 依熟悉度算
const KANJI_INTERVAL: Record<string, number> = { 忘記: 1, 學習中: 3, 熟悉: 7, 精通: 30 };

const KIND_LABEL = { quiz: "題庫", n3: "N3 單字", grammar: "N3 文型", vocab: "單字庫", verb: "動詞の形", kanji: "漢字" } as const;

const rich = (s: string) => ({ rich_text: s ? [{ text: { content: s.slice(0, 1900) } }] : [] });

/** 動詞の形：題目和正確答案由前端送來，不用讀頁面 */
async function logVerbAttempt(payload: AnswerPayload, day: string) {
  const pageId = payload.id.split(":")[0];
  await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: DS.attempts },
    properties: {
      題目: w.title((payload.prompt ?? "動詞の形").slice(0, 200)),
      日期: w.date(day),
      類型: w.select(KIND_LABEL.verb),
      語言: w.select("🇯🇵 日文"),
      結果: w.select(payload.correct ? "✅ 對" : "❌ 錯"),
      批改方式: w.select("自動比對"),
      我的答案: rich(payload.answer ?? ""),
      正確答案: rich(payload.reference ?? ""),
      來源頁面: { url: `https://www.notion.so/${pageId.replace(/-/g, "")}` },
    } as never,
  });
}

/** 每答一題在「📝 作答紀錄」寫一筆，供紀錄頁與錯題分析使用 */
async function logAttempt(page: Page, payload: AnswerPayload, day: string) {
  const title = {
    quiz: () => text(page, "題目"),
    n3: () => text(page, "單字 / 단어"),
    grammar: () => text(page, "文型 / 문형"),
    vocab: () => text(page, "單字"),
    verb: () => payload.prompt ?? "",
    kanji: () => text(page, "漢字"),
  }[payload.kind]();
  const reference = {
    quiz: () => text(page, "正確答案"),
    n3: () => `${text(page, "讀音 / 요미가나")} ${text(page, "中文")}`,
    grammar: () => text(page, "中文説明 / 중국어 뜻"),
    vocab: () => `${text(page, "音標/假名")} ${text(page, "中文翻譯")}`,
    verb: () => payload.reference ?? "",
    kanji: () => [text(page, "音読み"), text(page, "訓読み"), text(page, "中文意思")].filter(Boolean).join("／"),
  }[payload.kind]();
  const english = payload.kind === "vocab" && select(page, "語言") === "🇬🇧 英文";
  const qtype = payload.kind === "quiz" ? select(page, "題型") : null;
  await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: DS.attempts },
    properties: {
      題目: w.title(title.slice(0, 200) || "（無題目）"),
      日期: w.date(day),
      類型: w.select(KIND_LABEL[payload.kind]),
      ...(qtype ? { 題型: w.select(qtype) } : {}),
      語言: w.select(english ? "🇬🇧 英文" : "🇯🇵 日文"),
      結果: w.select(payload.correct ? "✅ 對" : "❌ 錯"),
      批改方式: w.select(payload.method ?? "自評"),
      我的答案: rich(payload.answer ?? ""),
      正確答案: rich(reference),
      "AI 評語": rich(payload.feedback ?? ""),
      來源頁面: { url: page.url },
    } as never,
  });
}

export async function submitAnswer(payload: AnswerPayload): Promise<void> {
  const { kind, id, correct } = payload;
  const day = today();
  if (useMock()) return mockAnswer();
  if (kind === "verb") return logVerbAttempt(payload, day);
  const page = await getPage(id);
  // 作答紀錄失敗（例如資料庫還沒分享）不影響 SRS 寫回
  const logged = logAttempt(page, payload, day).catch((e) => console.error("作答紀錄寫入失敗", e));

  if (kind === "quiz") {
    const u = quizUpdate(day, date(page, "上次測驗"), date(page, "下次複習"), correct);
    await updatePage(id, {
      上次測驗: w.date(u.lastTested),
      上次結果: w.select(u.result),
      下次複習: w.date(u.nextReview),
      // 答錯時記下自己寫了什麼，錯題區可以對照；答對就清掉
      ...(correct ? { 我的答案: { rich_text: [] } } : payload.answer ? { 我的答案: { rich_text: [{ text: { content: payload.answer.slice(0, 1900) } }] } } : {}),
    });
    // 關聯單字的熟悉度跟著題目對錯更新
    for (const vid of relationIds(page, "關聯單字")) {
      // 關聯單字被刪掉（合併重複單字後在垃圾桶）或讀不到：跳過，不讓整題作答失敗
      const v = await getPage(vid).catch((e) => (console.error("關聯單字讀取失敗", vid, e), null));
      if (!v || v.in_trash || v.archived) continue;
      const vu = vocabUpdate(select(v, "熟悉度"), num(v, "答對次數"), num(v, "答錯次數"), correct);
      await updatePage(vid, {
        熟悉度: w.status(vu.status),
        答對次數: w.number(vu.rightCount),
        答錯次數: w.number(vu.wrongCount),
        上次測驗: w.date(day),
      });
    }
  } else if (kind === "kanji") {
    const vu = vocabUpdate(select(page, "熟悉度"), num(page, "答對次數"), num(page, "答錯次數"), correct);
    await updatePage(id, {
      熟悉度: w.status(vu.status),
      答對次數: w.number(vu.rightCount),
      答錯次數: w.number(vu.wrongCount),
      上次複習: w.date(day),
      下次複習: w.date(addDays(day, KANJI_INTERVAL[vu.status] ?? 1)),
    });
  } else if (kind === "vocab") {
    const vu = vocabUpdate(select(page, "熟悉度"), num(page, "答對次數"), num(page, "答錯次數"), correct);
    await updatePage(id, {
      熟悉度: w.status(vu.status),
      答對次數: w.number(vu.rightCount),
      答錯次數: w.number(vu.wrongCount),
      上次測驗: w.date(day),
    });
  } else if (kind === "n3") {
    await updatePage(id, {
      熟悉度_K: w.status(n3NextLevel(select(page, "熟悉度_K"), correct)),
      上次複習_K: w.date(day),
    });
  } else {
    const next = n3NextLevel(grammarBase(select(page, "熟悉度 / 숙련도")), correct);
    await updatePage(id, {
      "熟悉度 / 숙련도": w.status(GRAMMAR_LEVEL_FULL[next]),
      "上次複習 / 지난 복습": w.date(day),
    });
    revalidateTag("n3-grammar");
  }
  await logged;
}

/** 錯題區：題庫裡上次答錯的題目，最近答錯的在前 */
export async function getMistakes(): Promise<QuizItem[]> {
  if (useMock()) return mockReview().filter((i): i is QuizItem => i.kind === "quiz" && i.lastResult === "❌ 錯");
  const pages = await queryAll(
    DS.quiz,
    { property: "上次結果", select: { equals: "❌ 錯" } },
    [{ property: "上次測驗", direction: "descending" }],
    200,
  );
  return pages.map(toQuiz);
}

/** 複習結束：勾今天 Journal 的 🇯🇵 Class Review，並把時數加進 Study hours。 */
export async function logJournal(minutes: number): Promise<void> {
  const day = today();
  if (useMock()) return mockJournal();
  const found = await queryAll(DS.journal, { property: "Date", date: { equals: day } });
  let entry = found[0];
  if (!entry) {
    const created = await notion().pages.create({
      parent: { type: "data_source_id", data_source_id: DS.journal },
      properties: { Title: w.title(day.replaceAll("-", "/")), Date: w.date(day) } as never,
    });
    entry = await getPage(created.id);
  }
  const hours = Math.round((num(entry, "Study hours") + minutes / 60) * 10) / 10;
  await updatePage(entry.id, { "🇯🇵 Class Review": w.checkbox(true), "Study hours": w.number(hours) });
}

/** Life Planner Tasks 打勾：Status 改成 Done、填 Completed at；取消改回原本的 Status（不知道就 Queued）、清掉 Completed at */
export async function setPlannerTaskDone(id: string, done: boolean, prev: string | null): Promise<void> {
  if (useMock()) return;
  const page = await getPage(id);
  const source = page.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (source !== DS.tasks.replace(/-/g, "")) throw new Error("不是 Tasks 的頁面");
  const back = prev && TASK_OPEN_STATUSES.includes(prev) ? prev : "Queued";
  await updatePage(id, done ? { Status: w.status("Done"), "Completed at": w.date(today()) } : { Status: w.status(back), "Completed at": { date: null } });
}

// ── TED／單字庫 ─────────────────────────────────────

export async function getTedLogEntry(id: string): Promise<{ id: string; title: string; link: string; notionUrl: string; progress: string | null }> {
  if (useMock()) return { id, title: "How to make stress your friend", link: "https://www.ted.com/talks/mock", notionUrl: "#", progress: "今天做" };
  const p = await getPage(id);
  return { id: p.id, title: text(p, "Talk"), link: text(p, "連結"), notionUrl: p.url, progress: select(p, "進度") };
}

/** TED 做完（或取消）：寫回 TED Log 的「進度」和「完成日」，回傳寫完的進度 */
export async function setTedDone(id: string, done: boolean, prev?: string | null): Promise<string | null> {
  const day = today();
  if (useMock()) return done ? "完成" : (prev ?? "今天做");
  const page = await getPage(id);
  const source = page.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (source !== DS.tedLog.replace(/-/g, "")) throw new Error("不是 TED Log 的頁面");
  const current = { progress: select(page, "進度"), doneDate: date(page, "完成日") };
  const change = tedDoneChange(current, done, day, prev);
  if (!change) return current.progress;
  const props: Record<string, unknown> = {};
  if (change.progress) props["進度"] = w.status(change.progress);
  if (change.doneDate !== undefined) props["完成日"] = change.doneDate ? w.date(change.doneDate) : { date: null };
  await updatePage(id, props);
  return change.progress ?? current.progress;
}

/** 從播放器把單字加進 📖 單字庫；同語言同名已存在就不重複建。中文翻譯等欄位交給 Notion AI 自動填入。 */
export async function addVocab(word: string, sentence: string, lang: "en" | "ja"): Promise<{ created: boolean; url: string }> {
  if (useMock()) return { created: true, url: "#" };
  const language = lang === "en" ? "🇬🇧 英文" : "🇯🇵 日文";
  const existing = await queryAll(
    DS.vocab,
    { and: [{ property: "單字", title: { equals: word } }, { property: "語言", select: { equals: language } }] },
    undefined,
    1,
  );
  if (existing[0]) return { created: false, url: existing[0].url };
  const page = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: DS.vocab },
    properties: {
      單字: w.title(word),
      語言: w.select(language),
      例句: { rich_text: [{ text: { content: sentence.slice(0, 1900) } }] },
      加入日期: w.date(today()),
      熟悉度: w.status("學習中"),
    } as never,
  });
  return { created: true, url: "url" in page ? page.url : "#" };
}

// ── 紀錄頁／日文・英文分頁 ────────────────────────────────

export type Attempt = { id: string; day: string; title: string; kind: string; correct: boolean; answer: string; reference: string; url: string };

const toAttempt = (p: Page, fallbackDay: string): Attempt => ({
  id: p.id,
  day: date(p, "日期") ?? fallbackDay,
  title: text(p, "題目"),
  kind: select(p, "類型") ?? "",
  correct: select(p, "結果") === "✅ 對",
  answer: text(p, "我的答案"),
  reference: text(p, "正確答案"),
  url: text(p, "來源頁面") || p.url,
});

/** 📝 作答紀錄：from～to（含）這幾天 */
async function attemptsBetween(from: string, to: string): Promise<Attempt[]> {
  const day = today();
  if (useMock()) return mockHistory(day).filter((a) => from <= a.day && a.day <= to);
  const pages = await queryAll(
    DS.attempts,
    { and: [{ property: "日期", date: { on_or_after: from } }, { property: "日期", date: { on_or_before: to } }] },
    [{ property: "日期", direction: "descending" }],
    5000,
  );
  return pages.map((p) => toAttempt(p, day));
}

// 過去的日子不會再有新的作答：每天的統計（題數、答對、各類型）快取起來，只有今天即時讀
const cachedDayStats = unstable_cache(async (from: string, to: string) => dayStats(await attemptsBetween(from, to)), ["attempt-day-stats-v1"], {
  revalidate: 7 * 86400,
});
const statsBetween = (from: string, to: string) => (useMock() ? attemptsBetween(from, to).then(dayStats) : cachedDayStats(from, to));

/** 某個月每天的作答統計；todayStats＝今天的（即時讀的那份），只有當月會用到 */
async function monthStats(month: string, day: string, todayStats: Record<string, DayStat>): Promise<Record<string, DayStat>> {
  const first = `${month}-01`;
  if (month < day.slice(0, 7)) return statsBetween(first, monthEnd(month));
  if (month > day.slice(0, 7)) return {};
  return { ...(day > first ? await statsBetween(first, addDays(day, -1)) : {}), ...todayStats };
}

export type HistoryView = {
  today: string;
  /** 每天的統計：要看的那個月、這個月和上個月（這週／上週），連續天數跨月時再往前 */
  stats: Record<string, DayStat>;
  /** 選的那一天的作答 */
  dayItems: Attempt[];
};

/** 紀錄頁：月曆用每天的統計（過去的有快取），作答內容只讀選的那一天 */
export async function getHistoryView(month: string, selected: string): Promise<HistoryView> {
  const day = today();
  const todays = await attemptsBetween(day, day);
  const todayStats = dayStats(todays);
  const thisMonth = day.slice(0, 7);
  const months = [...new Set([month, thisMonth, shiftMonth(thisMonth, -1)])];
  const [dayItems, ...loaded] = await Promise.all([
    selected === day ? todays : attemptsBetween(selected, selected),
    ...months.map((m) => monthStats(m, day, todayStats)),
  ]);
  const stats: Record<string, DayStat> = Object.assign({}, ...loaded);
  // 連續天數：一路連到已讀的最早那個月的 1 號，就再往前讀一個月（最多一年）
  let earliest = shiftMonth(thisMonth, -1);
  for (let i = 0; i < 12 && streak(day, countsOf(stats)) >= diffDays(`${earliest}-01`, day); i++) {
    earliest = shiftMonth(earliest, -1);
    Object.assign(stats, await monthStats(earliest, day, todayStats));
  }
  return { today: day, stats, dayItems };
}

const countsOf = (stats: Record<string, DayStat>) => Object.fromEntries(Object.entries(stats).map(([d, s]) => [d, s.n]));

// ── 本季目標（Life Planner 的 🏔 Goals）──────────────────────

export type GoalView = {
  id: string;
  name: string;
  area: string | null;
  url: string;
  target: number;
  current: number;
  /** App 算出來的（並寫回 Notion 的 Current）；false＝照 Notion 填的 */
  auto: boolean;
};

const GOAL_AREAS = ["🇯🇵 Japanese", "🇬🇧 English"];

/** 這一季有作答、或 Journal 勾了「🇯🇵 Class Review」的天數 */
async function studyDays(q: Quarter, day: string): Promise<number> {
  const todayStats = dayStats(await attemptsBetween(day, day));
  const [journal, ...months] = await Promise.all([
    queryAll(DS.journal, {
      and: [
        { property: "Date", date: { on_or_after: q.start } },
        { property: "Date", date: { on_or_before: day } },
        { property: "🇯🇵 Class Review", checkbox: { equals: true } },
      ],
    }),
    ...quarterMonths(q, day).map((m) => monthStats(m, day, todayStats)),
  ]);
  const days = new Set(journal.flatMap((p) => date(p, "Date") ?? []));
  for (const m of months) for (const [d, s] of Object.entries(m)) if (s.n && d >= q.start) days.add(d);
  return days.size;
}

async function autoValue(kind: AutoKind, target: number, q: Quarter, day: string): Promise<number> {
  if (kind === "ted") {
    // TED Log：這一季有「完成日」的 talk
    const done = await queryAll(DS.tedLog, {
      and: [{ property: "完成日", date: { on_or_after: q.start } }, { property: "完成日", date: { on_or_before: q.end } }],
    });
    return done.length;
  }
  if (kind === "days") return studyDays(q, day);
  // 積壓＝初級還沒複習的課堂筆記；清掉幾篇＝目標篇數 − 還剩幾篇
  const left = await queryAll(DS.isiNotes, { and: [{ property: "レベル", select: { equals: "初級" } }, { property: "複習", select: { equals: "未複習" } }] });
  return Math.max(target - left.length, 0);
}

async function loadGoals(day: string): Promise<GoalView[]> {
  const q = quarterOf(day);
  const pages = await queryAll(DS.goals, {
    and: [
      { property: "Level", select: { equals: "Quarter" } },
      { property: "Period", select: { equals: q.period } },
      { or: GOAL_AREAS.map((a) => ({ property: "Area", select: { equals: a } })) },
    ],
  });
  return Promise.all(
    pages.map(async (p): Promise<GoalView> => {
      const base = { id: p.id, name: text(p, "Name"), area: select(p, "Area"), url: p.url, target: num(p, "Target") };
      const kind = autoKind(base.name);
      if (!kind) return { ...base, current: num(p, "Current"), auto: false };
      const current = await autoValue(kind, base.target, q, day);
      // 寫回 Goals 的 Current（數字有變才寫），Notion 的進度條跟著動
      if (current !== num(p, "Current")) await updatePage(p.id, { Current: w.number(current) }).catch((e) => console.error("Goals 寫回失敗", e));
      return { ...base, current, auto: true };
    }),
  );
}

const cachedGoals = unstable_cache(loadGoals, ["quarter-goals-v1"], { revalidate: 600, tags: ["goals"] });

/** 紀錄頁「本季目標」：日文、英文的季度關鍵結果；讀不到（Goals 還沒連線）回傳 error */
export async function getGoals(): Promise<{ quarter: Quarter; goals: GoalView[]; error: string | null }> {
  const day = today();
  const quarter = quarterOf(day);
  if (useMock())
    return {
      quarter,
      goals: [
        { id: "g1", name: "Review Japanese 80 days", area: "🇯🇵 Japanese", url: "#", target: 80, current: 31, auto: true },
        { id: "g2", name: "Clear ISI review backlog (22 classes)", area: "🇯🇵 Japanese", url: "#", target: 22, current: 12, auto: true },
        { id: "g3", name: "Watch 36 TED talks", area: "🇬🇧 English", url: "#", target: 36, current: 4, auto: true },
      ],
      error: null,
    };
  try {
    return { quarter, goals: await cachedGoals(day), error: null };
  } catch (e) {
    return { quarter, goals: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export type ClassNoteLink = { id: string; title: string; lesson: string; level: string | null; date: string | null; url: string; review: string | null };

const toClassNoteLink = (p: Page): ClassNoteLink => ({
  id: p.id,
  title: text(p, "課堂標題"),
  lesson: text(p, "課次"),
  level: select(p, "レベル"),
  date: date(p, "日期"),
  url: p.url,
  review: select(p, "複習"),
});

export async function recentClassNotes(n: number): Promise<ClassNoteLink[]> {
  if (useMock())
    return [{ id: MOCK_NOTE_ID, title: "10/23 L3 ST2", lesson: "L3", level: "初中級", date: "2026-10-23", url: "#", review: "未複習" }];
  const pages = await queryAll(DS.isiNotes, undefined, [{ property: "日期", direction: "descending" }], n);
  return pages.map(toClassNoteLink);
}

/** 還沒複習的課堂筆記（複習＝未複習），從最舊的開始 */
export async function pendingClassNotes(level: string): Promise<ClassNoteLink[]> {
  if (useMock())
    return [
      { id: MOCK_NOTE_ID, title: "10/9（金）できる L1｜ST1 新しい一歩", lesson: "L1", level, date: "2026-10-09", url: "#", review: "未複習" },
      { id: MOCK_NOTE_ID, title: "10/23 L3 ST2", lesson: "L3", level, date: "2026-10-23", url: "#", review: "未複習" },
    ];
  const pages = await queryAll(
    DS.isiNotes,
    { and: [{ property: "レベル", select: { equals: level } }, { property: "複習", select: { equals: "未複習" } }] },
    [{ property: "日期", direction: "ascending" }],
  );
  return pages.map(toClassNoteLink);
}

/** 課堂筆記「標記已複習」：寫回「複習」欄；只接受 Notion 現有的選項 */
export async function setClassNoteReview(id: string, value: string): Promise<void> {
  if (!NOTE_REVIEW_OPTIONS.includes(value)) throw new Error(`「複習」沒有這個選項：${value}`);
  if (useMock()) return;
  const page = await getPage(id);
  const source = page.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (source !== DS.isiNotes.replace(/-/g, "")) throw new Error("不是 ISI 課堂筆記的頁面");
  await updatePage(id, { 複習: w.select(value) });
}

export type ClassNoteDetail = ClassNoteLink & { grammar: GrammarPoint[] };

const rtSegs = (rt: { plain_text: string; annotations: { bold: boolean } }[]): Seg[] => rt.map((r) => ({ text: r.plain_text, bold: r.annotations.bold }));
const segsOf = (b: object): Seg[] => {
  const v = (b as Record<string, { rich_text?: { plain_text: string; annotations: { bold: boolean } }[] }>)[(b as { type: string }).type];
  return rtSegs(v?.rich_text ?? []);
};

type FullBlock = Awaited<ReturnType<typeof allChildren>>[number];

/** 一個區塊連同子條列（兩層）或表格內容 */
async function noteTree(b: FullBlock, depth = 0): Promise<NoteBlock> {
  const node: NoteBlock = { type: b.type, segs: segsOf(b) };
  if (!b.has_children || depth > 1) return node;
  const kids = await allChildren(b.id);
  if (b.type === "table")
    return { ...node, header: b.table.has_column_header, rows: kids.flatMap((r) => (r.type === "table_row" ? [r.table_row.cells.map(rtSegs)] : [])) };
  return { ...node, children: await Promise.all(kids.map((k) => noteTree(k, depth + 1))) };
}

/** 只展開「文法」那一節的子條列和表格（其他節不用多讀） */
async function noteBlocks(id: string): Promise<NoteBlock[]> {
  let inGrammar = false;
  const top = (await allChildren(id)).map((b) => {
    if (b.type === "heading_1" || b.type === "heading_2") inGrammar = segsOf(b).some((x) => x.text.includes("文法"));
    return { b, expand: inGrammar };
  });
  return Promise.all(top.map(({ b, expand }) => (expand ? noteTree(b) : { type: b.type, segs: segsOf(b) })));
}

// 筆記改了（頁面最後編輯時間變了）就重讀；沒改就用快取
const cachedNoteGrammar = unstable_cache(async (id: string, edited: string) => (edited ? parseNoteGrammar(await noteBlocks(id)) : []), ["class-note-grammar-v2"], {
  revalidate: 86400,
});

/** 課堂筆記：屬性＋「## 文法（全部）」的 ①②③ */
export async function getClassNote(id: string): Promise<ClassNoteDetail | null> {
  if (useMock())
    return {
      ...(await recentClassNotes(1))[0],
      grammar: [
        {
          no: "①",
          title: "〜ために、〜（目的）",
          pattern: [[{ text: "V辞書形＋ために、〜／Nの＋ために、〜", bold: false }]],
          explain: [[{ text: "目的「為了〜」", bold: true }, { text: "。名詞のときは必ず「の」。", bold: false }]],
          examples: [
            { ja: [{ text: "ケーキを作るために、卵とバターを買います。", bold: false }], note: "" },
            { ja: [{ text: "健康のために、バランスよく食べます。", bold: false }], note: "為了健康" },
          ],
          mistakes: [[{ text: "×上手するために→○上手になるために", bold: true }]],
        },
      ],
    };
  const page = await getPage(id).catch(() => null);
  const source = page?.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (!page || source !== DS.isiNotes.replace(/-/g, "")) return null;
  return { ...toClassNoteLink(page), grammar: await cachedNoteGrammar(id, page.last_edited_time) };
}

export type TedLink = { id: string; title: string; progress: string | null };

export async function getEnglishHub(): Promise<{
  ted: TedLink[];
  books: (Link & { type: string | null })[];
  eviu: ReturnType<typeof eviuProgress> | null;
  errors: string[];
}> {
  if (useMock())
    return {
      ted: [{ id: "00000000-0000-4000-8000-0000000000d1", title: "How to make stress your friend", progress: "今天做" }],
      books: [{ title: "Atomic Habits", url: "#", type: "Book" }],
      eviu: eviuProgress(await getEviuUnits()),
      errors: [],
    };
  const errors: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> =>
    fn().catch((e) => {
      errors.push(`${label}：${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    });
  const [ted, books, eviu] = await Promise.all([
    safe("TED Log", () => queryAll(DS.tedLog, undefined, [{ timestamp: "created_time", direction: "descending" }], 40), [] as Page[]),
    safe("Books", () => queryAll(DS.books, { property: "Status", select: { equals: "Reading" } }), [] as Page[]),
    safe("EVIU Units", getEviuUnits, null),
  ]);
  const order: Record<string, number> = { 今天做: 0, 待做: 2 };
  return {
    ted: ted
      .filter((p) => !text(p, "Talk").includes("模板"))
      .map((p) => ({ id: p.id, title: text(p, "Talk"), progress: select(p, "進度") }))
      .sort((a, b) => (order[a.progress ?? ""] ?? 9) - (order[b.progress ?? ""] ?? 9)),
    books: books.map((p) => ({ title: text(p, "Name"), url: p.url, type: select(p, "Type") })),
    eviu: eviu && eviuProgress(eviu),
    errors,
  };
}

// ── English Vocabulary in Use ───────────────────────────

const toEviu = (p: Page): EviuUnit => ({
  id: p.id,
  no: num(p, "No."),
  unit: text(p, "Unit"),
  theme: select(p, "Theme"),
  status: select(p, "Status"),
  studied: date(p, "Studied"),
  url: p.url,
});

/** EVIU 的 100 個單元，依 No. 排序 */
export async function getEviuUnits(): Promise<EviuUnit[]> {
  if (useMock())
    return Array.from({ length: 6 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000e0${String(i + 1).padStart(2, "0")}`,
      no: i + 1,
      unit: ["Learning vocabulary", "Keeping a vocabulary notebook", "Using your dictionary", "English language words", "Classroom language", "Countries, nationalities and languages"][i],
      theme: i < 5 ? "Learning" : "The world around us",
      status: i < 2 ? "Reviewing" : i === 2 ? "Studying" : "Not started",
      studied: i < 3 ? "2026-11-0" + (i + 1) : null,
      url: "#",
    }));
  return (await queryAll(DS.eviu, undefined, [{ property: "No.", direction: "ascending" }], 200)).map(toEviu);
}

/** 單元標成 Studying／Reviewing／Done（或改回 Not started），並填 Studied 日期（null＝清掉） */
export async function setEviuUnit(id: string, change: { status?: string; studied?: string | null }): Promise<void> {
  if (change.status !== undefined && !(EVIU_STATUSES as readonly string[]).includes(change.status)) throw new Error(`Status 沒有這個選項：${change.status}`);
  if (useMock()) return;
  const page = await getPage(id);
  const source = page.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (source !== DS.eviu.replace(/-/g, "")) throw new Error("不是 EVIU Units 的頁面");
  const props: Record<string, unknown> = {};
  if (change.status !== undefined) props.Status = w.select(change.status);
  if (change.studied !== undefined) props.Studied = change.studied ? w.date(change.studied) : { date: null };
  await updatePage(id, props);
}

// ── 多読書庫 ─────────────────────────────────────────

const cachedTadokuBooks = unstable_cache(
  async (): Promise<TadokuBook[]> => {
    const r = await fetch(TADOKU_URL, { headers: { "user-agent": "StudyHub personal reading log" } });
    if (!r.ok) throw new Error(`多読網站回應 ${r.status}`);
    return parseTadoku(await r.text());
  },
  ["tadoku-books"],
  { revalidate: 86400 },
);

export async function getTadokuBooks(): Promise<TadokuBook[]> {
  if (useMock())
    return [
      { id: "61273", title: "ちょっと来て！", level: "Start", url: "https://tadoku.org/japanese/book/61273/", cover: null, tags: ["ふりがな付き"] },
      { id: "40182", title: "犬と肉〜イソップ物語より", level: "0", url: "https://tadoku.org/japanese/book/40182/", cover: null, tags: ["ふりがな付き", "音声あり"] },
      { id: "50001", title: "浦島太郎", level: "1", url: "https://tadoku.org/japanese/book/50001/", cover: null, tags: [] },
    ];
  return cachedTadokuBooks();
}

const cachedTadokuDetail = unstable_cache(
  async (id: string): Promise<TadokuDetail> => {
    const r = await fetch(`https://tadoku.org/japanese/book/${id}/`, { headers: { "user-agent": "StudyHub personal reading log" } });
    if (!r.ok) throw new Error(`多読網站回應 ${r.status}`);
    return parseTadokuBook(await r.text());
  },
  ["tadoku-book"],
  { revalidate: 7 * 86400 },
);

export async function getTadokuDetail(id: string): Promise<TadokuDetail> {
  if (useMock()) return { youtube: "ReJug5QyW_I", audio: null, pdf: [] };
  return cachedTadokuDetail(id);
}

export type TadokuRead = { pageId: string; date: string | null };

/** 讀過的書：書號 → 讀完日期 */
export async function getTadokuLog(): Promise<Record<string, TadokuRead>> {
  if (useMock()) return { "61273": { pageId: "m1", date: "2026-10-25" } };
  const pages = await queryAll(DS.tadokuLog, undefined, undefined, 1000);
  return Object.fromEntries(pages.map((p) => [text(p, "書號"), { pageId: p.id, date: date(p, "讀完日期") }]));
}

/** 讀完／取消讀完（取消就把那筆紀錄移到垃圾桶） */
export async function toggleTadokuRead(bookId: string): Promise<{ read: boolean }> {
  if (useMock()) return { read: true };
  const existing = await queryAll(DS.tadokuLog, { property: "書號", rich_text: { equals: bookId } } as never, undefined, 5);
  if (existing.length) {
    for (const p of existing) await notion().pages.update({ page_id: p.id, in_trash: true } as never);
    return { read: false };
  }
  const book = (await getTadokuBooks()).find((b) => b.id === bookId);
  if (!book) throw new Error("書單裡找不到這本書");
  await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: DS.tadokuLog },
    properties: {
      書名: w.title(book.title),
      レベル: w.select(book.level),
      連結: { url: book.url },
      書號: { rich_text: [{ text: { content: book.id } }] },
      讀完日期: w.date(today()),
    } as never,
  });
  return { read: true };
}

// ── VOA Learning English ─────────────────────────────────

const voaFetch = async (path: string) => {
  const r = await fetch(`${VOA_BASE}${path}`, { headers: { "user-agent": "StudyHub personal reader" } });
  if (!r.ok) throw new Error(`VOA 回應 ${r.status}`);
  return r.text();
};
const cachedVoaFeed = unstable_cache(async (id: string) => parseVoaFeed(await voaFetch(`/api/${id}`)), ["voa-feed"], { revalidate: 86400 });
const cachedVoaArticle = unstable_cache(async (id: string) => parseVoaArticle(await voaFetch(`/a/${id}.html`)), ["voa-article"], {
  revalidate: 30 * 86400,
});

const MOCK_VOA_ARTICLE: VoaArticle = {
  title: "Wilbur and Orville Wright: The First Airplane",
  audio: null,
  paragraphs: [
    "Wilbur and Orville Wright are the American inventors who made a small engine-powered flying machine. They proved that flight without the aid of gas-filled balloons was possible.",
    "The Wright brothers did many tests with gliders at Kitty Hawk. With these tests, they learned how to solve many problems.",
  ],
  words: [{ term: "glider", def: "n. a flying object similar to an airplane but without an engine" }],
  credit: ["Marilyn Rice Christiano wrote this story for VOA Learning English. John Russell adapted it."],
};

export async function getVoaFeed(key: VoaFeedKey): Promise<VoaItem[]> {
  if (useMock()) return [{ id: "7998765", title: MOCK_VOA_ARTICLE.title, description: "The first powered flight.", date: "2025-03-17" }];
  const feed = VOA_FEEDS.find((f) => f.key === key) ?? VOA_FEEDS[0];
  return cachedVoaFeed(feed.id);
}

export async function getVoaArticle(id: string): Promise<VoaArticle> {
  if (useMock()) return MOCK_VOA_ARTICLE;
  return cachedVoaArticle(id);
}

// ── できる日本語 課文音檔 ─────────────────────────────────

const richText = (b: object): string => {
  const v = (b as Record<string, { rich_text?: { plain_text: string }[] }>)[(b as { type: string }).type];
  return (v?.rich_text ?? []).map((r) => r.plain_text).join("");
};

async function allChildren(id: string) {
  const out = [];
  let cursor: string | undefined;
  do {
    const res = await notion().blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 });
    out.push(...res.results.filter(isFullBlock));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

// Notion 檔案網址一小時後失效。快取過期時 unstable_cache 會先回舊的（網址已失效）再背景更新，
// 所以另外記下失效時間，快到期就直接重抓；頁面上的音檔一律走 /api/lesson-audio/[no] 轉到當下有效的網址。
async function loadLessonAudioIndex() {
  const urls: Record<string, string> = {};
  let expires = Infinity;
  for (const b of await allChildren(LESSON_AUDIO_PAGE)) {
    if (b.type === "audio" && b.audio.type === "file") {
      const key = audioKey(b.audio.file.url);
      if (key) urls[key] = b.audio.file.url;
      const t = Date.parse(b.audio.file.expiry_time);
      if (t < expires) expires = t;
    }
  }
  return { urls, expires: Number.isFinite(expires) ? expires : 0 };
}

const cachedLessonAudioIndex = unstable_cache(loadLessonAudioIndex, ["lesson-audio-index-v3"], { revalidate: 1800, tags: ["lesson-audio"] });

/** 音檔網址：快取裡的還有 10 分鐘以上才用，否則直接向 Notion 重抓 */
async function lessonAudioIndex(): Promise<{ urls: Record<string, string>; fresh: boolean }> {
  const cached = await cachedLessonAudioIndex();
  if (cached.expires - Date.now() > 10 * 60_000) return { urls: cached.urls, fresh: false };
  return { urls: (await loadLessonAudioIndex()).urls, fresh: true };
}

/** /api/lesson-audio/[key]：回傳這個音檔（"A08"）當下有效的 Notion 網址；拿到新的就順便更新快取 */
export async function lessonAudioUrl(key: string): Promise<string | null> {
  const { urls, fresh } = await lessonAudioIndex();
  if (fresh) revalidateTag("lesson-audio");
  return urls[key] ?? null;
}

/**
 * 在 TEXTBOOK_INDEX_PARENTS 底下（含 toggle／分欄裡）找標題符合的子頁。
 * 某頁讀不到只記 log；一頁都沒找到就丟錯，讓 unstable_cache 不要把空結果快取一整天
 * （呼叫端都有 catch，讀不到時畫面照樣顯示，只是沒有課本順序／課文）。
 */
async function textbookIndexPages(match: (title: string) => boolean) {
  const pages = (
    await findChildPages(TEXTBOOK_INDEX_PARENTS, allChildren, {
      onError: (parent, e) => console.warn(`課本索引：讀不到 ${parent}（integration 有連線嗎？）`, e instanceof Error ? e.message : e),
    })
  ).filter((p) => match(p.title));
  if (!pages.length) throw new Error("課本索引：所有 parent 底下都找不到索引頁");
  return pages;
}

// 課文從「初中級課本索引｜L〇」讀（「できる日本語 初中級」課程頁的 toggle 裡，一課一頁）
const cachedIndexPages = unstable_cache(
  async () => textbookIndexPages((t) => t.startsWith("初中級課本索引")),
  ["textbook-index-pages-v2"],
  { revalidate: 86400 },
);

const boldPrefix = (b: object): string => {
  const v = (b as Record<string, { rich_text?: { plain_text: string; annotations: { bold: boolean } }[] }>)[(b as { type: string }).type];
  const out: string[] = [];
  for (const r of v?.rich_text ?? []) {
    if (!r.annotations.bold) break;
    out.push(r.plain_text);
  }
  return out.join("");
};

const cachedTranscript = unstable_cache(
  async (pageId: string): Promise<TranscriptPart[]> =>
    parseIndexPage((await allChildren(pageId)).map((b): IndexBlock => ({ type: b.type, text: richText(b), bold: boldPrefix(b) }))),
  ["lesson-transcript-index"],
  { revalidate: 3600 },
);

export type LessonAudio = { n: number; title: string; tracks: (AudioRow & { url: string | null })[]; transcript: TranscriptPart[] };

export async function getLessonAudio(n: number): Promise<LessonAudio> {
  if (useMock())
    return {
      n,
      title: lessonTitle(n),
      tracks: lessonRows(n, ["A01", "A02", "A08", "A09"]).map((t) => ({ ...t, url: t.key ? `/api/lesson-audio/${t.key}` : null })),
      transcript: parseTranscript([
        { type: "heading_2", text: "聞いてみよう" },
        { type: "heading_3", text: "（場面）" },
        { type: "paragraph", text: "Ａ：（本機預覽用的假台詞）" },
        { type: "paragraph", text: "Ｂ：課文從 Notion 的課文頁讀。" },
        { type: "heading_2", text: "話読聞書" },
        { type: "paragraph", text: "（本機預覽用的假短文）" },
        { type: "heading_2", text: "チャレンジ" },
        { type: "heading_3", text: "ST1 1" },
        { type: "paragraph", text: "Ａ：（場面 1 的假台詞）" },
        { type: "paragraph", text: "Ｂ：はい。" },
      ]),
    };
  // 課本索引讀不到時，音檔照樣能聽
  const [{ urls }, pages] = await Promise.all([cachedLessonAudioIndex(), cachedIndexPages().catch(() => [])]);
  // 網址本身會過期，頁面上只放自己的轉址路徑（播放時才換成有效網址）
  const page = pages.find((p) => new RegExp(`｜L${n}\\s`).test(p.title));
  return {
    n,
    title: page?.title.match(new RegExp(`｜L${n}\\s+([^（(]+)`))?.[1].trim() || lessonTitle(n),
    tracks: lessonRows(n, Object.keys(urls)).map((t) => ({ ...t, url: t.key ? `/api/lesson-audio/${t.key}` : null })),
    transcript: page ? await cachedTranscript(page.id).catch(() => []) : [],
  };
}

// ── 口說練習（言ってみよう）────────────────────────────

/** 口說練習：這本課本有資料的課次，和指定課次的題組（照「順序」排）。沒指定課次時初中級看最新一課、初級從 L1 開始。題目圖的 Notion 網址一小時後失效，頁面每次重新讀 */
export async function getSpeaking(book: Book, lesson: string | null): Promise<{ lessons: string[]; lesson: string | null; sets: SpeakingSet[] }> {
  if (useMock()) return { lessons: [], lesson: null, sets: [] };
  const pages = await queryAll(DS.speaking, undefined, [{ property: "順序", direction: "ascending" }]);
  const lessons = [...new Set(pages.map((p) => select(p, "課次")).filter((l): l is string => !!l && bookOf(l) === book))].sort((a, b) => lessonNo(a) - lessonNo(b));
  const pick = lesson && lessons.includes(lesson) ? lesson : ((book === "初級" ? lessons[0] : lessons[lessons.length - 1]) ?? null);
  const sets = pages
    .filter((p) => select(p, "課次") === pick)
    .map((p): SpeakingSet => {
      const img = files(p, "題目圖")[0];
      return {
        id: p.id,
        lesson: pick ?? "",
        st: text(p, "ST"),
        no: text(p, "題號"),
        page: numOrNull(p, "課本頁"),
        image: img ? { url: img.url, expires: img.expires } : null,
        items: parseAnswers(text(p, "解答")),
        note: text(p, "備註"),
      };
    });
  return { lessons, lesson: pick, sets };
}

