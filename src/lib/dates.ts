// 日期一律用 "YYYY-MM-DD" 字串處理，避免時區誤差。

export function todayISO(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUTC(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

/** 0 = 日, 6 = 土 */
export function weekday(iso: string): number {
  return toUTC(iso).getUTCDay();
}

export function isWeekend(iso: string): boolean {
  const w = weekday(iso);
  return w === 0 || w === 6;
}

const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "10/27（火）" */
export function formatJP(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}（${JP_WEEKDAYS[weekday(iso)]}）`;
}
