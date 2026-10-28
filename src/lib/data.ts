import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { isFullBlock } from "@notionhq/client";
import { DS, EXAMS, GRAMMAR_ORDER, LESSON_AUDIO_PAGE, TEXTBOOK_INDEX_PARENT, N3_BATCH_SAMPLE, N3_DUE_LIMIT, QUIZ_DAILY_LIMIT, TZ, W3_PARENT_PAGE } from "./config";
import { addDays, diffDays, formatJP, isWeekend, todayISO } from "./dates";
import { gradeWithAi } from "./ai";
import { groupBySection, sectionTitle, type IndexSection } from "./lessonOrder";
import { parseDetail, type N3Detail } from "./n3Detail";
import { autoGrade, gradeChoice, parseChoices } from "./grading";
import { mockAnswer, mockHistory, mockN3Detail, mockJournal, mockReview, mockToday, mockVocab } from "./mock";
import { byTime, eventsOnDay, nextEventDay, type CalendarEvent } from "./calendar";
import { GROUP_OF, VERB_CLASSES, conjugate, formsFor, parseVerb, type Verb, type VerbClass, type VerbForm } from "./conjugate";
import { VOA_BASE, VOA_FEEDS, parseVoaArticle, parseVoaFeed, type VoaArticle, type VoaFeedKey, type VoaItem } from "./voa";
import { TADOKU_URL, parseTadoku, parseTadokuBook, type TadokuBook, type TadokuDetail } from "./tadoku";
import { lessonTitle, lessonTracks, parseIndexPage, parseTranscript, trackNumber, type IndexBlock, type Track, type TranscriptPart } from "./lessonAudio";
import { parseNoteGrammar, type GrammarPoint, type Seg } from "./noteGrammar";
import { pickPreviewPage, summarizePreview, type ChildPage, type SimpleBlock } from "./preview";
import { date, getPage, hasNotion, notion, num, queryAll, relationIds, select, text, updatePage, w, type Page } from "./notion";
import {
  dailySample,
  grammarIndexForDate,
  matchGrammar,
  n3BatchRange,
  n3NextLevel,
  quizUpdate,
  vocabUpdate,
  weekGrammarIndices,
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
async function quizDue(day: string): Promise<Page[]> {
  const due = { property: "下次複習", date: { on_or_before: day } };
  const sorts = [{ property: "下次複習", direction: "ascending" as const }];
  const pick = (pages: Page[]) => pages.filter((p) => date(p, "上次測驗") !== day);

  const urgent = pick(
    await queryAll(DS.quiz, {
        and: [
          due,
          {
            or: [
              { property: "上次結果", select: { does_not_equal: "✅ 對" } },
              { property: "上次結果", select: { is_empty: true } },
            ],
          },
        ],
      }, sorts, QUIZ_DAILY_LIMIT),
  );
  if (urgent.length >= QUIZ_DAILY_LIMIT) return urgent.slice(0, QUIZ_DAILY_LIMIT);
  const rest = pick(
    await queryAll(DS.quiz, { and: [due, { property: "上次結果", select: { equals: "✅ 對" } }] }, sorts, QUIZ_DAILY_LIMIT),
  );
  return [...urgent, ...rest].slice(0, QUIZ_DAILY_LIMIT);
}

const N3_LEVEL_FILTER = {
  or: [
    { property: "JLPT Level", select: { equals: "N3" } },
    { property: "JLPT Level", select: { equals: "N2+" } },
  ],
};

// N3 文法補強只有 52 筆、很少變：快取一小時，複習答題改了熟悉度就清掉
const cachedGrammarAll = unstable_cache(() => queryAll(DS.n3Grammar), ["n3-grammar-all"], { revalidate: 3600, tags: ["n3-grammar"] });

// N3／N2+ 字的編號（排序好）：把「第幾個字」換算成編號範圍。資料庫前段多是 N5，直接用編號切會很不平均
const cachedN3Numbers = unstable_cache(
  async () =>
    (await queryAll(DS.n3Words, N3_LEVEL_FILTER, [{ property: "編號 / 번호", direction: "ascending" }], 5000))
      .map((p) => num(p, "編號 / 번호"))
      .filter((n) => n > 0),
  ["n3-numbers"],
  { revalidate: 86400 },
);

async function n3Batch(day: string): Promise<Page[]> {
  const range = n3BatchRange(day);
  if (!range) return [];
  const nos = await cachedN3Numbers();
  if (range.lo >= nos.length) return [];
  const lo = range.lo > 0 ? nos[range.lo - 1] : 0;
  const hi = nos[Math.min(range.hi, nos.length) - 1];
  return queryAll(
    DS.n3Words,
    {
      and: [
        { property: "編號 / 번호", number: { greater_than: lo } },
        { property: "編號 / 번호", number: { less_than_or_equal_to: hi } },
        N3_LEVEL_FILTER,
      ],
    },
    [{ property: "編號 / 번호", direction: "ascending" }],
  );
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

function todaysGrammarNames(day: string): string[] {
  const idx = isWeekend(day) ? weekGrammarIndices(day) : [grammarIndexForDate(day)].filter((i) => i !== null);
  return idx.map((i) => GRAMMAR_ORDER[i as number]);
}

const grammarBase = (s: string | null) => (s ? s.split(" / ")[0] : null);

async function grammarForReview(day: string): Promise<Page[]> {
  const all = await cachedGrammarAll();
  const names = todaysGrammarNames(day);
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

/** 今晚複習：題庫到期題 → N3 到期字 → 今日批次抽 10 → 文型 */
export async function getReviewQueue(): Promise<ReviewItem[]> {
  const day = today();
  if (useMock()) return mockReview();
  const [quiz, batch, due, grammar] = await Promise.all([quizDue(day), n3Batch(day), n3Due(day), grammarForReview(day)]);
  const dueItems = due.slice(0, N3_DUE_LIMIT).map((p) => toN3(p, "due"));
  const dueIds = new Set(dueItems.map((i) => i.id));
  const batchItems = dailySample(
    batch.filter((p) => !dueIds.has(p.id) && date(p, "上次複習_K") !== day).map((p) => toN3(p, "batch")),
    N3_BATCH_SAMPLE,
    day,
  );
  return [...quiz.map(toQuiz), ...dueItems, ...batchItems, ...grammar.map(toGrammar)];
}

/** Morning brief：今日 N3 批次（唯讀） */
/** 某一天的 N3 批次（預設今天；可以回頭看前幾天的） */
export async function getN3Batch(day = today()): Promise<{ words: N3WordItem[]; grammar: GrammarItem[] }> {
  if (useMock()) {
    const items = mockReview();
    return {
      words: items.filter((i): i is N3WordItem => i.kind === "n3"),
      grammar: items.filter((i): i is GrammarItem => i.kind === "grammar"),
    };
  }
  const [batch, grammarAll] = await Promise.all([n3Batch(day), cachedGrammarAll()]);
  const idx = grammarIndexForDate(day);
  const name = idx === null ? null : GRAMMAR_ORDER[idx];
  return {
    words: batch.map((p) => toN3(p, "batch")),
    grammar: name ? grammarAll.filter((p) => matchGrammar(name, text(p, "文型 / 문형"))).map(toGrammar) : [],
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

const toVocab = (p: Page): VocabItem => ({
  kind: "vocab",
  id: p.id,
  word: text(p, "單字"),
  reading: text(p, "音標/假名"),
  meaning: text(p, "中文翻譯"),
  pos: select(p, "詞性"),
  usage: text(p, "搭配・用法"),
  examples: [
    { ja: text(p, "例句"), zh: text(p, "例句翻譯") },
    { ja: text(p, "例句2"), zh: text(p, "例句2翻譯") },
  ].filter((e) => e.ja),
  lesson: select(p, "課次"),
  lang: select(p, "語言") === "🇬🇧 英文" ? "en" : "ja",
  status: select(p, "熟悉度"),
  right: num(p, "答對次數"),
  wrong: num(p, "答錯次數"),
});

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
  const pages = await queryAll(DS.vocab, (s.lang === "en" ? ENGLISH_NOT_MASTERED : { and }) as never, undefined, 600);
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

/** 日文分頁：某一課的單字（依加入順序＝課本順序） */
// 課本索引頁（初中級：「初中級課本索引｜L〇 …」；初級：「課本索引｜L〇 …」）
const cachedLessonIndexPages = unstable_cache(
  async () =>
    (await allChildren(TEXTBOOK_INDEX_PARENT)).flatMap((b) =>
      b.type === "child_page" && /課本索引｜L\d/.test(b.child_page.title) ? [{ id: b.id, title: b.child_page.title }] : [],
    ),
  ["lesson-index-pages"],
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

export async function getToday(): Promise<TodayData> {
  const day = today();
  if (useMock()) return mockToday(day);

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

  const [calendar, preview, homework, review, batch, grammarAll, notes, ted, books] = await Promise.all([
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
    safe("今晚複習", getReviewQueue, [] as ReviewItem[]),
    safe("N3 單字", () => n3Batch(day), [] as Page[]),
    safe("N3 文法", cachedGrammarAll, [] as Page[]),
    safe("ISI 課堂筆記", () => queryAll(DS.isiNotes, { property: "日期", date: { equals: day } }), [] as Page[]),
    safe(
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
    safe("Books", () => queryAll(DS.books, { property: "Status", select: { equals: "Reading" } }), [] as Page[]),
  ]);

  const grammarNames = todaysGrammarNames(day);
  const tedPage = ted.find((p) => !text(p, "Talk").includes("模板"));
  const note = notes[0];

  return {
    date: day,
    dateLabel: formatJP(day),
    weekend,
    exams: EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 7),
    homework: homework
      .map((p) => ({ text: text(p, "作業"), due: date(p, "作業截止")!, url: p.url, daysLeft: diffDays(day, date(p, "作業截止")!) }))
      .filter((h) => h.text)
      .sort((a, b) => a.daysLeft - b.daysLeft),
    calendar: calendar?.today ?? null,
    nextCalendar: calendar?.next ?? null,
    preview,
    n3: n3BatchRange(day)
      ? {
          count: batch.length,
          grammar: grammarNames.map((name) => ({
            name,
            url: grammarAll.find((p) => matchGrammar(name, text(p, "文型 / 문형")))?.url ?? null,
          })),
        }
      : null,
    classNote: note
      ? {
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
    ted: tedPage ? { title: text(tedPage, "Talk"), url: `/ted/${tedPage.id}`, progress: select(tedPage, "進度") } : null,
    books: books.map((p) => ({ title: text(p, "Name"), url: p.url, type: select(p, "Type") })),
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
      const v = await getPage(vid);
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

// ── TED／單字庫 ─────────────────────────────────────

export async function getTedLogEntry(id: string): Promise<{ title: string; link: string; notionUrl: string }> {
  if (useMock()) return { title: "How to make stress your friend", link: "https://www.ted.com/talks/mock", notionUrl: "#" };
  const p = await getPage(id);
  return { title: text(p, "Talk"), link: text(p, "連結"), notionUrl: p.url };
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

/** 📝 作答紀錄：最近 days 天（含今天） */
export async function getHistory(days: number): Promise<{ today: string; attempts: Attempt[] }> {
  const day = today();
  if (useMock()) return { today: day, attempts: mockHistory(day) };
  const pages = await queryAll(
    DS.attempts,
    { property: "日期", date: { on_or_after: addDays(day, -(days - 1)) } },
    [{ property: "日期", direction: "descending" }],
    5000,
  );
  return {
    today: day,
    attempts: pages.map((p) => ({
      id: p.id,
      day: date(p, "日期") ?? day,
      title: text(p, "題目"),
      kind: select(p, "類型") ?? "",
      correct: select(p, "結果") === "✅ 對",
      answer: text(p, "我的答案"),
      reference: text(p, "正確答案"),
      url: text(p, "來源頁面") || p.url,
    })),
  };
}

export type ClassNoteLink = { id: string; title: string; lesson: string; level: string | null; date: string | null; url: string };

export async function recentClassNotes(n: number): Promise<ClassNoteLink[]> {
  if (useMock())
    return [{ id: "c1", title: "10/23 L3 ST2", lesson: "L3", level: "初中級", date: "2026-10-23", url: "#" }];
  const pages = await queryAll(DS.isiNotes, undefined, [{ property: "日期", direction: "descending" }], n);
  return pages.map((p) => ({
    id: p.id,
    title: text(p, "課堂標題"),
    lesson: text(p, "課次"),
    level: select(p, "レベル"),
    date: date(p, "日期"),
    url: p.url,
  }));
}

export type ClassNoteDetail = ClassNoteLink & { homework: string; grammar: GrammarPoint[] };

const segsOf = (b: object): Seg[] => {
  const v = (b as Record<string, { rich_text?: { plain_text: string; annotations: { bold: boolean } }[] }>)[(b as { type: string }).type];
  return (v?.rich_text ?? []).map((r) => ({ text: r.plain_text, bold: r.annotations.bold }));
};

const cachedNoteGrammar = unstable_cache(
  async (id: string) => parseNoteGrammar((await allChildren(id)).map((b) => ({ type: b.type, segs: segsOf(b) }))),
  ["class-note-grammar"],
  { revalidate: 600 },
);

/** 課堂筆記：屬性＋「## 文法（全部）」的 ①②③ */
export async function getClassNote(id: string): Promise<ClassNoteDetail | null> {
  if (useMock())
    return {
      ...(await recentClassNotes(1))[0],
      homework: "①文法ノート 大8〜13番",
      grammar: [
        {
          no: "①",
          title: "〜ために、〜（目的）",
          bullets: [
            { label: "句型", segs: [{ text: "V辞書形＋ために、〜／Nの＋ために、〜", bold: false }] },
            { label: "說明", segs: [{ text: "目的「為了〜」", bold: true }, { text: "。名詞のときは必ず「の」。", bold: false }] },
            { label: "例", segs: [{ text: "ケーキを作るために、卵とバターを買います。／健康のために、バランスよく食べます。", bold: false }] },
            { label: "⚠️易錯", segs: [{ text: "×上手するために→○上手になるために", bold: true }] },
          ],
        },
      ],
    };
  const page = await getPage(id).catch(() => null);
  const source = page?.parent.type === "data_source_id" ? page.parent.data_source_id.replace(/-/g, "") : "";
  if (!page || source !== DS.isiNotes.replace(/-/g, "")) return null;
  return {
    id: page.id,
    title: text(page, "課堂標題"),
    lesson: text(page, "課次"),
    level: select(page, "レベル"),
    date: date(page, "日期"),
    url: page.url,
    homework: text(page, "作業"),
    grammar: await cachedNoteGrammar(id),
  };
}

export type TedLink = { id: string; title: string; progress: string | null };

export async function getEnglishHub(): Promise<{ ted: TedLink[]; books: (Link & { type: string | null })[]; errors: string[] }> {
  if (useMock())
    return {
      ted: [{ id: "mock", title: "How to make stress your friend", progress: "今天做" }],
      books: [{ title: "Atomic Habits", url: "#", type: "Book" }],
      errors: [],
    };
  const errors: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> =>
    fn().catch((e) => {
      errors.push(`${label}：${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    });
  const [ted, books] = await Promise.all([
    safe("TED Log", () => queryAll(DS.tedLog, undefined, [{ timestamp: "created_time", direction: "descending" }], 40), [] as Page[]),
    safe("Books", () => queryAll(DS.books, { property: "Status", select: { equals: "Reading" } }), [] as Page[]),
  ]);
  const order: Record<string, number> = { 今天做: 0, 待做: 2 };
  return {
    ted: ted
      .filter((p) => !text(p, "Talk").includes("模板"))
      .map((p) => ({ id: p.id, title: text(p, "Talk"), progress: select(p, "進度") }))
      .sort((a, b) => (order[a.progress ?? ""] ?? 9) - (order[b.progress ?? ""] ?? 9)),
    books: books.map((p) => ({ title: text(p, "Name"), url: p.url, type: select(p, "Type") })),
    errors,
  };
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

// Notion 檔案網址一小時後失效，快取 30 分鐘
const cachedLessonAudioIndex = unstable_cache(
  async () => {
    const urls: Record<number, string> = {};
    for (const b of await allChildren(LESSON_AUDIO_PAGE)) {
      if (b.type === "audio" && b.audio.type === "file") {
        const no = trackNumber(b.audio.file.url);
        if (no) urls[no] = b.audio.file.url;
      }
    }
    return { urls };
  },
  ["lesson-audio-index"],
  { revalidate: 1800 },
);

// 課文從「初中級課本索引｜L〇」讀（日本語計畫頁底下，一課一頁）
const cachedIndexPages = unstable_cache(
  async () =>
    (await allChildren(TEXTBOOK_INDEX_PARENT)).flatMap((b) =>
      b.type === "child_page" && b.child_page.title.startsWith("初中級課本索引") ? [{ id: b.id, title: b.child_page.title }] : [],
    ),
  ["textbook-index-pages"],
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

export type LessonAudio = { n: number; title: string; tracks: (Track & { url: string | null })[]; transcript: TranscriptPart[] };

export async function getLessonAudio(n: number): Promise<LessonAudio> {
  const tracks = lessonTracks(n);
  if (useMock())
    return {
      n,
      title: lessonTitle(n),
      tracks: tracks.map((t) => ({ ...t, url: null })),
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
  const page = pages.find((p) => new RegExp(`｜L${n}\\s`).test(p.title));
  return {
    n,
    title: page?.title.match(new RegExp(`｜L${n}\\s+([^（(]+)`))?.[1].trim() || lessonTitle(n),
    tracks: tracks.map((t) => ({ ...t, url: urls[t.no] ?? null })),
    transcript: page ? await cachedTranscript(page.id).catch(() => []) : [],
  };
}
