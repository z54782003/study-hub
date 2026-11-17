// 紀錄頁：作答熱度圖與連續天數
import { addDays, weekday } from "./dates";

export type DayCell = { day: string; count: number; future: boolean };

/** weeks 週的格子，一欄一週（週一在上），最後一欄包含 today */
export function heatmap(today: string, counts: Record<string, number>, weeks: number): DayCell[][] {
  const mondayOffset = (weekday(today) + 6) % 7; // 週一 = 0
  const start = addDays(today, -mondayOffset - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      return { day, count: counts[day] ?? 0, future: day > today };
    }),
  );
}

/** 連續有作答的天數；今天還沒做不算斷（從昨天往回數） */
export function streak(today: string, counts: Record<string, number>): number {
  let day = counts[today] ? today : addDays(today, -1);
  let n = 0;
  while (counts[day]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** 0–4 的顏色深淺 */
export function level(count: number): number {
  if (count === 0) return 0;
  if (count < 10) return 1;
  if (count < 20) return 2;
  if (count < 40) return 3;
  return 4;
}

/** 月曆格子：一列一週（週一在前），前後補 null；month 是 "YYYY-MM" */
export function monthGrid(month: string, today: string, counts: Record<string, number>): (DayCell | null)[][] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (weekday(first) + 6) % 7;
  const cells: (DayCell | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => {
      const day = addDays(first, i);
      return { day, count: counts[day] ?? 0, future: day > today };
    }),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** "YYYY-MM" 加減幾個月 */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 一天的作答統計；kinds＝各類型的 [題數, 答對] */
export type DayStat = { n: number; ok: number; kinds: Record<string, [number, number]> };

/** 把作答紀錄整理成每天的統計（紀錄頁只快取這個，不快取整批作答） */
export function dayStats(attempts: { day: string; kind: string; correct: boolean }[]): Record<string, DayStat> {
  const out: Record<string, DayStat> = {};
  for (const a of attempts) {
    const d = (out[a.day] ??= { n: 0, ok: 0, kinds: {} });
    const k = (d.kinds[a.kind || "其他"] ??= [0, 0]);
    d.n++;
    k[0]++;
    if (a.correct) {
      d.ok++;
      k[1]++;
    }
  }
  return out;
}

export type WeekSummary = {
  /** 週一到週日，各天有沒有作答 */
  days: { day: string; done: boolean; future: boolean }[];
  studied: number;
  n: number;
  ok: number;
  /** 各類型的題數與正確率，正確率低的在前 */
  kinds: { kind: string; n: number; pct: number }[];
};

/** today 往前 weeksAgo 週的那一週（0＝這週）的回顧 */
export function weekSummary(today: string, stats: Record<string, DayStat>, weeksAgo = 0): WeekSummary {
  const mondayOffset = (weekday(today) + 6) % 7;
  const monday = addDays(today, -mondayOffset - weeksAgo * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, done: !!stats[day]?.n, future: day > today };
  });
  const kinds: Record<string, [number, number]> = {};
  let n = 0;
  let ok = 0;
  for (const { day } of days) {
    const s = stats[day];
    if (!s) continue;
    n += s.n;
    ok += s.ok;
    for (const [k, [kn, kok]] of Object.entries(s.kinds)) {
      const t = (kinds[k] ??= [0, 0]);
      t[0] += kn;
      t[1] += kok;
    }
  }
  return {
    days,
    studied: days.filter((d) => d.done).length,
    n,
    ok,
    kinds: Object.entries(kinds)
      .map(([kind, [kn, kok]]) => ({ kind, n: kn, pct: Math.round((kok / kn) * 100) }))
      .sort((a, b) => a.pct - b.pct || b.n - a.n),
  };
}

/** "YYYY-MM" 的最後一天 */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
