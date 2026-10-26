import { describe, expect, it } from "vitest";
import { eventsOnDay } from "./calendar";

// 仿 iCloud 匯出的格式：VTIMEZONE + TZID 事件 + 重複事件 + 例外
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//iCloud//EN
BEGIN:VTIMEZONE
TZID:Asia/Tokyo
BEGIN:STANDARD
DTSTART:19510908T000000
TZOFFSETFROM:+1000
TZOFFSETTO:+0900
TZNAME:JST
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:class
SUMMARY:ISI 上課
LOCATION:ISI 307
DTSTART;TZID=Asia/Tokyo:20261005T130000
DTEND;TZID=Asia/Tokyo:20261005T161000
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261218T150000Z
EXDATE;TZID=Asia/Tokyo:20261103T130000
END:VEVENT
BEGIN:VEVENT
UID:class
RECURRENCE-ID;TZID=Asia/Tokyo:20261028T130000
SUMMARY:ISI 校外教學
DTSTART;TZID=Asia/Tokyo:20261028T090000
DTEND;TZID=Asia/Tokyo:20261028T150000
END:VEVENT
BEGIN:VEVENT
UID:dentist
SUMMARY:牙醫
DTSTART:20261027T003000Z
DTEND:20261027T013000Z
END:VEVENT
BEGIN:VEVENT
UID:trip
SUMMARY:京都旅行
DTSTART;VALUE=DATE:20261031
DTEND;VALUE=DATE:20261102
END:VEVENT
BEGIN:VEVENT
UID:late
SUMMARY:深夜 UTC 事件
DTSTART:20261026T160000Z
DTEND:20261026T170000Z
END:VEVENT
END:VCALENDAR`;

const titles = (day: string) => eventsOnDay(ICS, day, "Asia/Tokyo").map((e) => `${e.start ?? "全天"} ${e.title}`);

describe("eventsOnDay", () => {
  it("expands weekly recurrence and converts UTC to Tokyo time", () => {
    expect(eventsOnDay(ICS, "2026-10-27", "Asia/Tokyo")).toMatchObject([
      { title: "深夜 UTC 事件", start: "01:00", end: "02:00" }, // 10/26 16:00Z = 10/27 01:00 JST
      { title: "牙醫", start: "09:30", end: "10:30" },
      { title: "ISI 上課", start: "13:00", end: "16:10", location: "ISI 307" },
    ]);
  });
  it("applies a moved occurrence (RECURRENCE-ID) and EXDATE", () => {
    expect(titles("2026-10-28")).toEqual(["09:00 ISI 校外教學"]);
    expect(titles("2026-11-03")).toEqual([]);
  });
  it("does not show weekday recurrences on weekends; multi-day all-day events span days", () => {
    expect(titles("2026-10-31")).toEqual(["全天 京都旅行"]);
    expect(titles("2026-11-01")).toEqual(["全天 京都旅行"]);
    expect(titles("2026-11-02")).toEqual(["13:00 ISI 上課"]);
  });
  it("stops after UNTIL", () => {
    expect(titles("2026-12-21")).toEqual([]);
  });
});
