import { GRAMMAR_ORDER, N3_START } from "./config";
import { addDays, diffDays, isWeekend, weekday } from "./dates";

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

// 題目排序：先「❌ 錯」與「— 未作答」，再依下次複習由舊到新（操作手冊 W2 積壓處理）
export function quizPriority(lastResult: string | null): number {
  return lastResult === "✅ 對" ? 1 : 0;
}

// ── 📖 單字庫（W2 第 4 步／W2-B 第 4 步）────────────────────
// 錯→熟悉度=忘記、答錯次數+1；對→答對次數+1（忘記→學習中；學習中且答對累計 ≧3 → 熟悉）
export function vocabUpdate(status: string | null, rightCount: number, wrongCount: number, correct: boolean) {
  if (!correct) return { status: "忘記", rightCount, wrongCount: wrongCount + 1 };
  const right = rightCount + 1;
  let next = status ?? "學習中";
  if (next === "忘記" || next === "未學") next = "學習中";
  else if (next === "學習中" && right >= 3) next = "熟悉";
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

/** 第 d 天（10/8 為 0，週末照算）的單字批次編號範圍 (lo, hi]；超過 12/18 回傳 null（純複習期）。 */
export function n3BatchRange(today: string): { lo: number; hi: number } | null {
  const d = diffDays(N3_START, today);
  if (d < 0 || d > 71) return null;
  if (d <= 4) return { lo: 41 * d, hi: 41 * d + 41 };
  return { lo: 205 + 42 * (d - 5), hi: 205 + 42 * (d - 4) };
}

/** 第 k 個平日（10/8 為 1）；週末或超出 52 個回傳 null。回傳 0-based index。 */
export function grammarIndexForDate(today: string): number | null {
  if (isWeekend(today)) return null;
  const span = diffDays(N3_START, today);
  if (span < 0) return null;
  let k = 0;
  for (let i = 0; i <= span; i++) if (!isWeekend(addDays(N3_START, i))) k++;
  return k <= GRAMMAR_ORDER.length ? k - 1 : null;
}

/** 週末考本週 5 個：回傳本週一～五的文型 index。 */
export function weekGrammarIndices(today: string): number[] {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const out: number[] = [];
  for (let i = 0; i < 5; i++) {
    const idx = grammarIndexForDate(addDays(monday, i));
    if (idx !== null && addDays(monday, i) <= today) out.push(idx);
  }
  return out;
}

/** 文型名稱比對：去掉〜、空白、「系」後互相包含即算同一個。 */
export function normalizeGrammar(s: string): string {
  return s.replace(/[〜~\s　]/g, "").replace(/系$/, "");
}

export function matchGrammar(configName: string, title: string): boolean {
  const a = normalizeGrammar(configName);
  const b = normalizeGrammar(title);
  return a.length > 0 && b.length > 0 && (a === b || b.includes(a) || a.includes(b));
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
