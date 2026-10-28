import { describe, expect, it } from "vitest";
import { markWord, parseUsage } from "./usage";

describe("parseUsage", () => {
  it("splits phrases and their meanings", () => {
    expect(parseUsage("目標を立てる：訂目標／目標を達成する: 達成目標\n目標に向かって")).toEqual([
      { ja: "目標を立てる", zh: "訂目標" },
      { ja: "目標を達成する", zh: "達成目標" },
      { ja: "目標に向かって", zh: "" },
    ]);
  });
  it("reads the older 「・搭配：X——中文」 lines", () => {
    expect(parseUsage("・搭配：美容院（びよういん）に行く：去美容院\n・搭配：目標（もくひょう）を立（た）てる——訂立目標")).toEqual([
      { ja: "美容院（びよういん）に行く", zh: "去美容院" },
      { ja: "目標（もくひょう）を立（た）てる", zh: "訂立目標" },
    ]);
  });
});

describe("markWord", () => {
  it("highlights the word inside the example", () => {
    expect(markWord("今年の目標はN3です。目標！", "目標")).toEqual([
      { text: "今年の", hit: false },
      { text: "目標", hit: true },
      { text: "はN3です。", hit: false },
      { text: "目標", hit: true },
      { text: "！", hit: false },
    ]);
  });
  it("finds a conjugated verb by its stem", () => {
    expect(markWord("夢を諦めないで", "諦める")).toEqual([
      { text: "夢を", hit: false },
      { text: "諦め", hit: true },
      { text: "ないで", hit: false },
    ]);
  });
  it("returns the sentence unchanged when nothing matches", () => {
    expect(markWord("頑張って", "諦める")).toEqual([{ text: "頑張って", hit: false }]);
  });
});
