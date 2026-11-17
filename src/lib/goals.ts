// 本季目標（Life Planner 的 🏔 Goals：Level＝Quarter 的關鍵結果）
import { diffDays } from "./dates";

export type Quarter = { period: string; start: string; end: string };

/** 這一天在哪一季；period 是 Goals「Period」的選項名稱（Q4 2026） */
export function quarterOf(day: string): Quarter {
  const [y, m] = day.split("-").map(Number);
  const q = Math.ceil(m / 3);
  const first = (q - 1) * 3 + 1;
  const last = first + 2;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    period: `Q${q} ${y}`,
    start: `${y}-${pad(first)}-01`,
    end: `${y}-${pad(last)}-${pad(new Date(Date.UTC(y, last, 0)).getUTCDate())}`,
  };
}

/** 這一季的每個月（"YYYY-MM"），到 day 那個月為止 */
export function quarterMonths(q: Quarter, day: string): string[] {
  const [y, m] = q.start.split("-").map(Number);
  return [0, 1, 2].map((i) => `${y}-${String(m + i).padStart(2, "0")}`).filter((mo) => mo <= day.slice(0, 7));
}

export type AutoKind = "ted" | "days" | "backlog";

/** App 算得出來的關鍵結果（看名稱）：TED 支數、複習日文的天數、ISI 筆記積壓；其他的照 Notion 填的 Current */
export function autoKind(name: string): AutoKind | null {
  if (/\bTED\b/i.test(name)) return "ted";
  if (/backlog/i.test(name)) return "backlog";
  if (/\bdays\b/i.test(name)) return "days";
  return null;
}

/** 照時間比例現在應該到哪裡（四捨五入到整數） */
export function expected(target: number, q: Quarter, day: string): number {
  const total = diffDays(q.start, q.end) + 1;
  const passed = Math.min(Math.max(diffDays(q.start, day) + 1, 0), total);
  return Math.round((target * passed) / total);
}

/** 進度說明：達標／進度正常／落後幾個 */
export function paceText(current: number, target: number, q: Quarter, day: string): { text: string; behind: boolean } {
  if (target > 0 && current >= target) return { text: "達標", behind: false };
  const gap = expected(target, q, day) - current;
  return gap > 0 ? { text: `比進度少 ${gap}`, behind: true } : { text: "進度正常", behind: false };
}
