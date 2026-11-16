import { GRAMMAR_ORDER, N3_START } from "./config";
import { addDays, diffDays, weekday } from "./dates";

// ── 日文題庫 SRS（操作手冊 W2）────────────────────────────
// 新題目 → D+1 → D+3 → D+7 → D+14 → D+30；對→下一階，錯→回 D+1。
// 「階段從上次間隔推算」：上一次的間隔 = 下次複習 − 上次測驗；從沒測過的題目視為在 D+1 階。
export const QUIZ_LADDER = [1, 3, 7, 14, 30];

export function quizNextInterval(
  lastTested: string | null,
  nextReview: string | null,
  correct: boolean,
): number {
  if (!correct) return 1;
  const prev = lastTested && nextReview ? Math.max(diffDays(lastTested, nextReview), 1) : 1;
  return QUIZ_LADDER.find((step) => step > prev) ?? QUIZ_LADDER[QUIZ_LADDER.length - 1];
}

export function quizUpdate(today: string, lastTested: string | null, nextReview: string | null, correct: boolean) {
  return {
    lastTested: today,
    result: correct ? ("✅ 對" as const) : ("❌ 錯" as const),
    nextReview: addDays(today, quizNextInterval(lastTested, nextReview, correct)),
  };
}

// ── 📖 單字庫（W2 第 4 步／W2-B 第 4 步）────────────────────
// 錯→熟悉度=忘記、答錯次數+1；對→答對次數+1（忘記→學習中；學習中且答對累計 ≧3 → 熟悉；熟悉且答對累計 ≧6 → 精通）
export function vocabUpdate(status: string | null, rightCount: number, wrongCount: number, correct: boolean) {
  if (!correct) return { status: "忘記", rightCount, wrongCount: wrongCount + 1 };
  const right = rightCount + 1;
  let next = status ?? "學習中";
  if (next === "忘記" || next === "未學") next = "學習中";
  else if (next === "學習中" && right >= 3) next = "熟悉";
  else if (next === "熟悉" && right >= 6) next = "精通";
  return { status: next, rightCount: right, wrongCount };
}

// ── N3 單字／文型（N3 自補）──────────────────────────────
// SRS 由 Notion 公式依熟悉度推算（忘記 +1、學習中 +3、熟悉 +7、精通 +30），App 只更新熟悉度與上次複習。
export const N3_LEVELS = ["未學", "忘記", "學習中", "熟悉", "精通"] as const;
export type N3Level = (typeof N3_LEVELS)[number];

export function n3NextLevel(current: string | null, correct: boolean): N3Level {
  if (!correct) return "忘記";
  switch (current) {
    case "熟悉":
    case "精通":
      return "精通";
    case "學習中":
      return "熟悉";
    default:
      return "學習中";
  }
}

/**
 * N3 單字進度：nos＝所有 N3／N2+ 字的編號（由小到大），lo＝今日批次第一個字的編號。
 * 編號比今日批次小的都算學過；沒有批次（全部學完）時 lo 給 null。
 */
export function n3Progress(nos: number[], lo: number | null, perDay: number): { learned: number; total: number; left: number; days: number } {
  const total = nos.length;
  const at = lo === null ? -1 : nos.findIndex((n) => n >= lo);
  const learned = at < 0 ? total : at;
  const left = total - learned;
  return { learned, total, left, days: Math.ceil(left / perDay) };
}

/** 第 d 天學第 d 個文型（0-based）；超出 52 個回傳 null。 */
export function grammarIndexForDate(today: string): number | null {
  const d = diffDays(N3_START, today);
  return d >= 0 && d < GRAMMAR_ORDER.length ? d : null;
}

/** 週末複習本週學過的：回傳本週一到今天的文型 index。 */
export function weekGrammarIndices(today: string): number[] {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = grammarIndexForDate(addDays(monday, i));
    if (idx !== null && addDays(monday, i) <= today) out.push(idx);
  }
  return out;
}

/**
 * 文型名稱比對：資料庫標題常比清單長（「〜に対して／〜に関して／〜について」、「尊敬語動詞表」），
 * 所以去掉〜、空白、括號內容與「系」後，只比「／」前的第一個文型。
 */
export function normalizeGrammar(s: string): string {
  return s
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .replace(/[〜~\s　]/g, "")
    .split("／")[0]
    .replace(/系$/, "");
}

export function matchGrammar(configName: string, title: string): boolean {
  const a = normalizeGrammar(configName);
  const b = normalizeGrammar(title);
  return a.length > 0 && (a === b || b.startsWith(a));
}

/** 每天固定的抽樣（同一天重新整理不會換題）。 */
export function dailySample<T extends { id: string }>(items: T[], n: number, seed: string): T[] {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  return [...items].sort((x, y) => hash(seed + x.id) - hash(seed + y.id)).slice(0, n);
}
