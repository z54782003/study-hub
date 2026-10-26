import "server-only";
import { isFullBlock } from "@notionhq/client";
import { DS, EXAMS, GRAMMAR_ORDER, N3_BATCH_SAMPLE, N3_DUE_LIMIT, QUIZ_DAILY_LIMIT, TZ, W3_PARENT_PAGE } from "./config";
import { diffDays, formatJP, isWeekend, todayISO } from "./dates";
import { mockAnswer, mockJournal, mockReview, mockToday } from "./mock";
import { pickPreviewPage, type ChildPage } from "./preview";
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
import type { AnswerPayload, GrammarItem, N3WordItem, QuizItem, ReviewItem, TodayData } from "./types";

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
  return hit ? { title: hit.title, url: `https://www.notion.so/${hit.id.replace(/-/g, "")}` } : null;
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

  const [preview, review, batch, grammarAll, notes, ted, books] = await Promise.all([
    weekend ? null : safe("每日預習", () => findPreviewPage(day), null),
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
    classNote: note ? { title: text(note, "課堂標題"), url: note.url, status: select(note, "狀態") } : null,
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

export async function submitAnswer({ kind, id, correct }: AnswerPayload): Promise<void> {
  const day = today();
  if (useMock()) return mockAnswer();
  const page = await getPage(id);

  if (kind === "quiz") {
    const u = quizUpdate(day, date(page, "上次測驗"), date(page, "下次複習"), correct);
    await updatePage(id, {
      上次測驗: w.date(u.lastTested),
      上次結果: w.select(u.result),
      下次複習: w.date(u.nextReview),
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
    return;
  }

  if (kind === "n3") {
    await updatePage(id, {
      熟悉度_K: w.status(n3NextLevel(select(page, "熟悉度_K"), correct)),
      上次複習_K: w.date(day),
    });
    return;
  }

  const next = n3NextLevel(grammarBase(select(page, "熟悉度 / 숙련도")), correct);
  await updatePage(id, {
    "熟悉度 / 숙련도": w.status(GRAMMAR_LEVEL_FULL[next]),
    "上次複習 / 지난 복습": w.date(day),
  });
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
