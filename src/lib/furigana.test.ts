import { describe, expect, it } from "vitest";
import { flipReadings, hasReadings, rubyParts } from "./furigana";

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

describe("prefix readings", () => {
  it("drops the お／ご that was written into the reading", () => {
    expect(rubyParts("ご飯（ごはん）とお湯（おゆ）")).toEqual([
      { text: "ご", hit: false },
      { text: "飯", rt: "はん", hit: false },
      { text: "とお", hit: false },
      { text: "湯", rt: "ゆ", hit: false },
    ]);
  });
});

describe("flipReadings", () => {
  it("turns kana（漢字） answers into 漢字（かな）", () => {
    expect(flipReadings("② しゅうでん（終電）")).toBe("② 終電（しゅうでん）");
    expect(flipReadings("b) ひょうしょうじょう（表彰状）")).toBe("b) 表彰状（ひょうしょうじょう）");
    expect(flipReadings("② だいすき（大好き）")).toBe("② 大好（だいす）き");
    expect(flipReadings("① びんぼう（貧乏）")).toBe("① 貧乏（びんぼう）");
  });
  it("keeps prefixes outside the brackets", () => {
    expect(flipReadings("おかねもち（お金持ち）")).toBe("お金持（かねも）ち");
  });
  it("leaves normal 漢字（かな） and explanations alone", () => {
    expect(flipReadings("b 唐辛子（とうがらし）")).toBe("b 唐辛子（とうがらし）");
    expect(flipReadings("②（狀態的継続）")).toBe("②（狀態的継続）");
    expect(flipReadings("だし（無料だし）")).toBe("だし（無料だし）");
  });
});
