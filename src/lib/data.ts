import "server-only";
import { unstable_cache } from "next/cache";
import { isFullBlock } from "@notionhq/client";
import { DS, EXAMS, GRAMMAR_ORDER, N3_BATCH_SAMPLE, N3_DUE_LIMIT, QUIZ_DAILY_LIMIT, TZ, W3_PARENT_PAGE } from "./config";
import { addDays, diffDays, formatJP, isWeekend, todayISO } from "./dates";
import { gradeWithAi } from "./ai";
import { autoGrade, gradeChoice, parseChoices } from "./grading";
import { mockAnswer, mockHistory, mockJournal, mockReview, mockToday, mockVocab } from "./mock";
import { eventsOnDay, type CalendarEvent } from "./calendar";
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

async function n3Batch(day: string): Promise<Page[]> {
  const range = n3BatchRange(day);
  if (!range) return [];
  return queryAll(
    DS.n3Words,
    {
      and: [
        { property: "編號 / 번호", number: { greater_than: range.lo } },
        { property: "編號 / 번호", number: { less_than_or_equal_to: range.hi } },
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
  const all = await queryAll(DS.n3Grammar);
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
export async function getN3Batch(): Promise<{ words: N3WordItem[]; grammar: GrammarItem[] }> {
  const day = today();
  if (useMock()) {
    const items = mockReview();
    return {
      words: items.filter((i): i is N3WordItem => i.kind === "n3"),
      grammar: items.filter((i): i is GrammarItem => i.kind === "grammar"),
    };
  }
  const [batch, grammarAll] = await Promise.all([n3Batch(day), queryAll(DS.n3Grammar)]);
  const names = todaysGrammarNames(day);
  return {
    words: batch.map((p) => toN3(p, "batch")),
    grammar: grammarAll.filter((p) => names.some((n) => matchGrammar(n, text(p, "文型 / 문형")))).map(toGrammar),
  };
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
});

const VOCAB_RANK: Record<string, number> = { 忘記: 0, 學習中: 1, 未學: 2, 熟悉: 3, 精通: 4 };

async function vocabQuiz(s: Extract<ReviewSource, { src: "vocab" }>): Promise<VocabItem[]> {
  const and: object[] = [{ property: "語言", select: { equals: s.lang === "en" ? "🇬🇧 英文" : "🇯🇵 日文" } }];
  if (s.lang === "ja" && s.level) {
    const lessons = s.lessons.length ? s.lessons : Array.from({ length: 15 }, (_, i) => i + 1);
    and.push({ or: lessons.map((n) => ({ property: "課次", select: { equals: `${s.level} L${n}` } })) });
  }
  if (s.lang === "en") and.push({ property: "熟悉度", status: { does_not_equal: "精通" } });
  const pages = await queryAll(DS.vocab, { and } as never, undefined, 600);
  // 忘記 → 學習中 → 未學 → 熟悉 → 精通，同一級隨機
  return shuffle(pages.map(toVocab))
    .sort((a, b) => (VOCAB_RANK[a.status ?? "未學"] ?? 2) - (VOCAB_RANK[b.status ?? "未學"] ?? 2))
    .slice(0, s.count);
}

/** /api/review：依出題來源取題 */
export async function getReviewItems(s: ReviewSource): Promise<ReviewItem[]> {
  if (s.src === "due") return getReviewQueue();
  if (s.src === "mistakes") return (await getMistakes()).slice(0, 30);
  if (useMock()) return s.src === "vocab" ? mockVocab() : mockReview().filter((i) => i.kind === "quiz");
  return s.src === "bank" ? bankQuiz(s) : vocabQuiz(s);
}

/** 單字測驗選課畫面：每課有幾個字 */
// 要讀上千筆，快取一小時
const cachedVocabLessonCounts = unstable_cache(
  async () => {
    const pages = await queryAll(
      DS.vocab,
      { and: [{ property: "課次", select: { is_not_empty: true } }, { property: "課次", select: { does_not_equal: "未分類" } }] } as never,
      undefined,
      5000,
    );
    const counts: Record<string, number> = {};
    for (const p of pages) {
      const l = select(p, "課次");
      if (l) counts[l] = (counts[l] ?? 0) + 1;
    }
    return counts;
  },
  ["vocab-lesson-counts"],
  { revalidate: 3600 },
);

export async function vocabLessonCounts(): Promise<Record<string, number>> {
  if (useMock()) return { "初級 L1": 31, "初級 L2": 77, "初中級 L1": 33, "初中級 L2": 55, "初中級 L3": 58 };
  return cachedVocabLessonCounts();
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
  const blocks: SimpleBlock[] = res.results.filter(isFullBlock).map((b) => {
    const rich = (b as unknown as Record<string, { rich_text?: { plain_text: string; annotations: { bold: boolean } }[] }>)[b.type]
      ?.rich_text ?? [];
    return { type: b.type, text: rich.map((r) => r.plain_text).join(""), boldStart: Boolean(rich[0]?.annotations.bold) };
  });
  return { title: hit.title, url: `https://www.notion.so/${hit.id.replace(/-/g, "")}`, ...summarizePreview(blocks) };
}

/** 環境變數 ICAL_URLS：一個或多個 iCalendar 連結（空白或逗號分隔，webcal:// 也可以） */
async function calendarEvents(day: string): Promise<CalendarEvent[] | null> {
  const urls = (process.env.ICAL_URLS ?? "").split(/[\s,]+/).filter(Boolean);
  if (!urls.length) return null;
  const all = await Promise.all(
    urls.map(async (u) => {
      const res = await fetch(u.replace(/^webcal:/i, "https:"), { next: { revalidate: 300 } });
      if (!res.ok) throw new Error(`行事曆讀取失敗（${res.status}）`);
      return eventsOnDay(await res.text(), day, TZ);
    }),
  );
  return all.flat().sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.sortKey - b.sortKey);
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
    safe("N3 文法", () => queryAll(DS.n3Grammar), [] as Page[]),
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
    calendar,
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

const KIND_LABEL = { quiz: "題庫", n3: "N3 單字", grammar: "N3 文型", vocab: "單字庫" } as const;

/** 每答一題在「📝 作答紀錄」寫一筆，供紀錄頁與錯題分析使用 */
async function logAttempt(page: Page, payload: AnswerPayload, day: string) {
  const title = {
    quiz: () => text(page, "題目"),
    n3: () => text(page, "單字 / 단어"),
    grammar: () => text(page, "文型 / 문형"),
    vocab: () => text(page, "單字"),
  }[payload.kind]();
  const reference = {
    quiz: () => text(page, "正確答案"),
    n3: () => `${text(page, "讀音 / 요미가나")} ${text(page, "中文")}`,
    grammar: () => text(page, "中文説明 / 중국어 뜻"),
    vocab: () => `${text(page, "音標/假名")} ${text(page, "中文翻譯")}`,
  }[payload.kind]();
  const english = payload.kind === "vocab" && select(page, "語言") === "🇬🇧 英文";
  const rich = (s: string) => ({ rich_text: s ? [{ text: { content: s.slice(0, 1900) } }] : [] });
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

export type TedLink = { id: string; title: string; progress: string | null };

export async function getEnglishHub(): Promise<{ ted: TedLink[]; books: (Link & { type: string | null })[]; vocabCount: number; errors: string[] }> {
  if (useMock())
    return {
      ted: [{ id: "mock", title: "How to make stress your friend", progress: "今天做" }],
      books: [{ title: "Atomic Habits", url: "#", type: "Book" }],
      vocabCount: 12,
      errors: [],
    };
  const errors: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> =>
    fn().catch((e) => {
      errors.push(`${label}：${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    });
  const [ted, books, vocab] = await Promise.all([
    safe("TED Log", () => queryAll(DS.tedLog, undefined, [{ timestamp: "created_time", direction: "descending" }], 40), [] as Page[]),
    safe("Books", () => queryAll(DS.books, { property: "Status", select: { equals: "Reading" } }), [] as Page[]),
    safe(
      "英文單字",
      () =>
        queryAll(
          DS.vocab,
          { and: [{ property: "語言", select: { equals: "🇬🇧 英文" } }, { property: "熟悉度", status: { does_not_equal: "精通" } }] } as never,
          undefined,
          1000,
        ),
      [] as Page[],
    ),
  ]);
  const order: Record<string, number> = { 今天做: 0, 進行中: 1, 待做: 2 };
  return {
    ted: ted
      .filter((p) => !text(p, "Talk").includes("模板"))
      .map((p) => ({ id: p.id, title: text(p, "Talk"), progress: select(p, "進度") }))
      .sort((a, b) => (order[a.progress ?? ""] ?? 9) - (order[b.progress ?? ""] ?? 9)),
    books: books.map((p) => ({ title: text(p, "Name"), url: p.url, type: select(p, "Type") })),
    vocabCount: vocab.length,
    errors,
  };
}
