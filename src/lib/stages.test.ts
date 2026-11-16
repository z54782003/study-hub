import { describe, expect, it } from "vitest";
import { STAGES } from "./config";
import { n3WordsOn, n3WordsStart, needsDebtCheck, reviewParts, stageFor } from "./stages";

describe("stages", () => {
  it("are contiguous and in order", () => {
    for (let i = 1; i < STAGES.length; i++) {
      const prev = new Date(`${STAGES[i - 1].end}T00:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() + 1);
      expect(prev.toISOString().slice(0, 10), STAGES[i].name).toBe(STAGES[i].start);
    }
  });
  it("picks the stage by date", () => {
    expect(stageFor("2026-11-16").no).toBe(1); // 改版當天，第一階段還沒開始
    expect(stageFor("2026-11-17").no).toBe(1);
    expect(stageFor("2026-12-18").no).toBe(1);
    expect(stageFor("2026-12-19").no).toBe(2);
    expect(stageFor("2027-01-06").no).toBe(2);
    expect(stageFor("2027-01-07").no).toBe(3);
    expect(stageFor("2027-04-08").no).toBe(4);
    expect(stageFor("2027-08-01").no).toBe(4); // 計畫結束後維持最後一階段
  });
  it("turns on N3 words in stage 2 once the backlog is cleared or on 1/1", () => {
    const s2 = stageFor("2026-12-20");
    expect(n3WordsOn(stageFor("2026-12-01"), "2026-12-01", true)).toBe(false);
    expect(n3WordsOn(s2, "2026-12-20", false)).toBe(false);
    expect(n3WordsOn(s2, "2026-12-20", true)).toBe(true);
    expect(n3WordsOn(s2, "2027-01-01", false)).toBe(true);
    expect(n3WordsOn(stageFor("2027-01-07"), "2027-01-07", false)).toBe(true);
    expect(needsDebtCheck(s2, "2026-12-20")).toBe(true);
    expect(needsDebtCheck(s2, "2027-01-01")).toBe(false);
    expect(needsDebtCheck(stageFor("2027-01-07"), "2027-01-07")).toBe(false);
  });
  it("decides what goes into the due review", () => {
    expect(reviewParts(stageFor("2026-11-20"), false)).toEqual({ quiz: "due", n3: false, grammar: false });
    expect(reviewParts(stageFor("2026-12-20"), false)).toEqual({ quiz: "debt", n3: false, grammar: false });
    expect(reviewParts(stageFor("2027-01-02"), true)).toEqual({ quiz: "debt", n3: true, grammar: false });
    expect(reviewParts(stageFor("2027-01-07"), true)).toEqual({ quiz: "due", n3: true, grammar: true });
    expect(reviewParts(stageFor("2027-05-01"), false)).toEqual({ quiz: "due", n3: true, grammar: true });
  });
  it("explains when N3 words start", () => {
    expect(n3WordsStart("2026-11-20")).toBe("寒假清債題庫積壓清空或 1/1 開始，先到的那天");
    expect(n3WordsStart("2026-12-20")).toBe("題庫積壓清空或 1/1 開始，先到的那天");
    expect(n3WordsStart("2027-05-01")).toBe("單字量之後再定");
  });
});
