import { describe, expect, it } from "vitest";
import { heatmap, level, monthGrid, shiftMonth, streak } from "./history";

describe("heatmap", () => {
  it("ends in the week containing today, Monday first", () => {
    const grid = heatmap("2026-10-28", { "2026-10-26": 5 }, 2); // 10/28 是週三
    expect(grid).toHaveLength(2);
    expect(grid[1][0]).toEqual({ day: "2026-10-26", count: 5, future: false });
    expect(grid[1][2].day).toBe("2026-10-28");
    expect(grid[1][3].future).toBe(true);
    expect(grid[0][0].day).toBe("2026-10-19");
  });
});

describe("streak", () => {
  const counts = { "2026-10-24": 3, "2026-10-25": 1, "2026-10-26": 8 };
  it("counts back from today", () => expect(streak("2026-10-26", counts)).toBe(3));
  it("does not break when today has nothing yet", () => expect(streak("2026-10-27", counts)).toBe(3));
  it("is 0 after a missed day", () => expect(streak("2026-10-28", counts)).toBe(0));
});

describe("level", () => {
  it("buckets counts", () => expect([0, 1, 10, 25, 60].map(level)).toEqual([0, 1, 2, 3, 4]));
});

describe("monthGrid", () => {
  it("lays out October 2026 starting on Thursday, Monday first", () => {
    const g = monthGrid("2026-10", "2026-10-27", { "2026-10-27": 12 });
    expect(g).toHaveLength(5);
    expect(g[0].slice(0, 3)).toEqual([null, null, null]);
    expect(g[0][3]).toEqual({ day: "2026-10-01", count: 0, future: false });
    expect(g[4][1]).toEqual({ day: "2026-10-27", count: 12, future: false });
    expect(g[4][2]?.future).toBe(true);
    expect(g[4][6]).toBeNull();
  });
});

describe("shiftMonth", () => {
  it("crosses years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
