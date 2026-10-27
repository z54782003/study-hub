import { describe, expect, it } from "vitest";
import { charDiff } from "./diff";

describe("charDiff", () => {
  it("marks the extra and the missing characters", () => {
    const { mine, fixed } = charDiff("N3に合格のために、毎日勉強します。", "N3に合格するために、毎日勉強します。");
    expect(mine).toEqual([
      { text: "N3に合格", op: "same" },
      { text: "の", op: "del" },
      { text: "ために、毎日勉強します。", op: "same" },
    ]);
    expect(fixed).toEqual([
      { text: "N3に合格", op: "same" },
      { text: "する", op: "ins" },
      { text: "ために、毎日勉強します。", op: "same" },
    ]);
  });
  it("keeps identical strings as one part", () => {
    expect(charDiff("見る", "見る")).toEqual({ mine: [{ text: "見る", op: "same" }], fixed: [{ text: "見る", op: "same" }] });
  });
});
