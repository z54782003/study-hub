import { describe, expect, it } from "vitest";
import { tedDoneChange } from "./tedLog";

describe("TED Log progress", () => {
  const day = "2026-11-17";
  it("marks a talk 完成 with today's date", () => {
    expect(tedDoneChange({ progress: "今天做", doneDate: null }, true, day)).toEqual({ progress: "完成", doneDate: day });
    expect(tedDoneChange({ progress: null, doneDate: null }, true, day)).toEqual({ progress: "完成", doneDate: day });
  });
  it("never downgrades 已複習 and only fills a missing date", () => {
    expect(tedDoneChange({ progress: "已複習", doneDate: "2026-11-01" }, true, day)).toBeNull();
    expect(tedDoneChange({ progress: "完成", doneDate: null }, true, day)).toEqual({ doneDate: day });
  });
  it("undo goes back to the previous open state", () => {
    expect(tedDoneChange({ progress: "完成", doneDate: day }, false, day, "待做")).toEqual({ progress: "待做", doneDate: null });
    expect(tedDoneChange({ progress: "完成", doneDate: day }, false, day)).toEqual({ progress: "今天做", doneDate: null });
    expect(tedDoneChange({ progress: "今天做", doneDate: null }, false, day)).toBeNull();
  });
});
