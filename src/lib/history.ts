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
