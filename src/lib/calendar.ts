// 解析 iCalendar（.ics）找出某一天的行程：重複事件（RRULE／EXDATE／單次修改）、全天事件、時區都要處理。
import ICAL from "ical.js";
import { addDays } from "./dates";

export type CalendarEvent = {
  title: string;
  allDay: boolean;
  /** "HH:mm"（tz 當地時間），全天事件為 null */
  start: string | null;
  end: string | null;
  location: string | null;
  /** 排序用的毫秒時間戳 */
  sortKey: number;
};

function tzOffsetMs(instant: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUTC - instant;
}

/** tz 當地的「年月日時分秒」→ 絕對時間 */
function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  return guess - tzOffsetMs(guess - tzOffsetMs(guess, tz), tz);
}

function instantOf(t: ICAL.Time, tz: string): number {
  // 沒有時區的「浮動時間」視為使用者所在時區
  if (!t.zone || t.zone.tzid === "floating") return zoned(t.year, t.month, t.day, t.hour, t.minute, t.second, tz);
  return t.toJSDate().getTime();
}

const dateOf = (t: ICAL.Time) => `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

function hhmm(instant: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
}

export function eventsOnDay(ics: string, day: string, tz: string): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const vtz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(vtz);

  const [y, m, d] = day.split("-").map(Number);
  const dayStart = zoned(y, m, d, 0, 0, 0, tz);
  const next = addDays(day, 1).split("-").map(Number);
  const dayEnd = zoned(next[0], next[1], next[2], 0, 0, 0, tz);

  const events = root.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
  const masters = new Map<string, ICAL.Event>();
  for (const e of events) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  for (const e of events) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

  const out: CalendarEvent[] = [];
  const consider = (title: string, location: string | null, start: ICAL.Time, end: ICAL.Time) => {
    if (start.isDate) {
      // 全天事件：DTEND 是「不含」的那一天
      const s = dateOf(start);
      const e = end && end.compare(start) > 0 ? dateOf(end) : addDays(s, 1);
      if (s <= day && day < e) out.push({ title, allDay: true, start: null, end: null, location, sortKey: dayStart });
      return;
    }
    const s = instantOf(start, tz);
    const e = end ? instantOf(end, tz) : s;
    if (s < dayEnd && (e > dayStart || (e === s && s >= dayStart))) {
      out.push({
        title,
        allDay: false,
        start: s < dayStart ? "00:00" : hhmm(s, tz),
        end: e >= dayEnd ? "24:00" : hhmm(e, tz),
        location,
        sortKey: s,
      });
    }
  };

  for (const ev of masters.values()) {
    const title = ev.summary || "（無標題）";
    const location = ev.location || null;
    if (!ev.isRecurring()) {
      consider(title, location, ev.startDate, ev.endDate);
      continue;
    }
    const it = ev.iterator();
    // 安全上限：避免沒有結束日的每日重複事件跑太久
    for (let i = 0, t = it.next(); t && i < 5000; i++, t = it.next()) {
      const occ = ev.getOccurrenceDetails(t);
      if (instantOf(occ.startDate, tz) >= dayEnd && !occ.startDate.isDate) break;
      if (occ.startDate.isDate && dateOf(occ.startDate) > day) break;
      consider(occ.item.summary || title, occ.item.location || location, occ.startDate, occ.endDate);
    }
  }
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.sortKey - b.sortKey);
}

/** 從 day 的隔天起，最多往後 days 天，找第一個有行程的日子（多個行事曆合併） */
export function nextEventDay(icsList: string[], day: string, tz: string, days = 14): { date: string; events: CalendarEvent[] } | null {
  for (let i = 1; i <= days; i++) {
    const d = addDays(day, i);
    const events = icsList.flatMap((ics) => eventsOnDay(ics, d, tz)).sort(byTime);
    if (events.length) return { date: d, events };
  }
  return null;
}

/** 全天事件在前，其餘依開始時間 */
export const byTime = (a: CalendarEvent, b: CalendarEvent) => Number(b.allDay) - Number(a.allDay) || a.sortKey - b.sortKey;
