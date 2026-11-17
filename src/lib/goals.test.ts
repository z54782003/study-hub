import { describe, expect, it } from "vitest";
import { autoKind, expected, paceText, quarterMonths, quarterOf } from "./goals";

describe("quarterOf", () => {
  it("names the period like the Goals database", () => {
    expect(quarterOf("2026-11-17")).toEqual({ period: "Q4 2026", start: "2026-10-01", end: "2026-12-31" });
    expect(quarterOf("2027-02-10")).toEqual({ period: "Q1 2027", start: "2027-01-01", end: "2027-03-31" });
    expect(quarterOf("2027-06-30").end).toBe("2027-06-30");
  });
});

describe("quarterMonths", () => {
  it("stops at the current month", () => {
    expect(quarterMonths(quarterOf("2026-11-17"), "2026-11-17")).toEqual(["2026-10", "2026-11"]);
    expect(quarterMonths(quarterOf("2026-12-31"), "2026-12-31")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});

describe("autoKind", () => {
  it("recognises the three key results the app can count", () => {
    expect(autoKind("Watch 36 TED talks")).toBe("ted");
    expect(autoKind("Review Japanese 80 days")).toBe("days");
    expect(autoKind("Clear ISI review backlog (22 classes)")).toBe("backlog");
    expect(autoKind("Pilates 30 sessions")).toBeNull();
  });
});

describe("pace", () => {
  const q = quarterOf("2026-11-17");
  it("expects a share of the target in proportion to elapsed days", () => {
    expect(expected(92, q, "2026-10-01")).toBe(1);
    expect(expected(92, q, "2026-12-31")).toBe(92);
    expect(expected(80, q, "2026-11-17")).toBe(42); // 48/92 天
  });
  it("says how far behind", () => {
    expect(paceText(10, 80, q, "2026-11-17")).toEqual({ text: "比進度少 32", behind: true });
    expect(paceText(45, 80, q, "2026-11-17")).toEqual({ text: "進度正常", behind: false });
    expect(paceText(80, 80, q, "2026-11-17")).toEqual({ text: "達標", behind: false });
  });
});
