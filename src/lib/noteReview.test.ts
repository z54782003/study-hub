import { describe, expect, it } from "vitest";
import { nextNoteReview, noteReviewed } from "./noteReview";

describe("class note review", () => {
  it("steps 未複習 → 1回目 → 2回目 → 定着", () => {
    expect(nextNoteReview("未複習")).toBe("1回目 ✅");
    expect(nextNoteReview(null)).toBe("1回目 ✅");
    expect(nextNoteReview("1回目 ✅")).toBe("2回目 ✅✅");
    expect(nextNoteReview("2回目 ✅✅")).toBe("定着");
    expect(nextNoteReview("定着")).toBeNull();
    expect(nextNoteReview("要再看")).toBe("1回目 ✅");
  });
  it("counts 1回目 and later as reviewed", () => {
    expect(noteReviewed("未複習")).toBe(false);
    expect(noteReviewed("要再看")).toBe(false);
    expect(noteReviewed(null)).toBe(false);
    expect(noteReviewed("1回目 ✅")).toBe(true);
    expect(noteReviewed("定着")).toBe(true);
  });
});
