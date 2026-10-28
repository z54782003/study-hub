import { describe, expect, it } from "vitest";
import { hasReadings, rubyParts } from "./furigana";

describe("rubyParts", () => {
  it("turns bracketed readings into ruby", () => {
    expect(rubyParts("目標（もくひょう）を立（た）てる")).toEqual([
      { text: "目標", rt: "もくひょう", hit: false },
      { text: "を", hit: false },
      { text: "立", rt: "た", hit: false },
      { text: "てる", hit: false },
    ]);
  });
  it("highlights the word across ruby and plain text", () => {
    expect(rubyParts("明日は面接（めんせつ）です。", "面接")).toEqual([
      { text: "明日は", hit: false },
      { text: "面接", rt: "めんせつ", hit: true },
      { text: "です。", hit: false },
    ]);
    expect(rubyParts("面接に行く。", "面接")).toEqual([
      { text: "面接", hit: true },
      { text: "に行く。", hit: false },
    ]);
  });
  it("leaves non-reading brackets alone", () => {
    expect(rubyParts("駅（東口）")).toEqual([{ text: "駅（東口）", hit: false }]);
  });
});

describe("hasReadings", () => {
  it("detects bracketed kana after kanji", () => {
    expect(hasReadings("海外（かいがい）で働いた")).toBe(true);
    expect(hasReadings("海外で働いた")).toBe(false);
    expect(hasReadings("駅（東口）")).toBe(false);
  });
});
