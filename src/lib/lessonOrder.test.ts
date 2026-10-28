import { describe, expect, it } from "vitest";
import { groupBySection, sectionTitle } from "./lessonOrder";

describe("lesson vocab order", () => {
  it("cleans section headings", () => {
    expect(sectionTitle("4-1｜生活を楽しむ（p.56–59）")).toBe("4-1 生活を楽しむ");
    expect(sectionTitle("補｜話読聞書・もう一度聞こう（p.64・66）")).toBe("補 話読聞書・もう一度聞こう");
  });
  it("sorts words by textbook order and puts unknown words last", () => {
    const sections = [
      { title: "4-1", words: ["美容院", "空港", "質問・する", "必要(な)"] },
      { title: "4-2", words: ["大使館", "〜行き"] },
    ];
    const words = ["行き", "必要", "大使館", "おまけ", "美容院", "質問する"].map((word) => ({ word }));
    expect(groupBySection(words, sections)).toEqual([
      { title: "4-1", words: [{ word: "美容院" }, { word: "質問する" }, { word: "必要" }] },
      { title: "4-2", words: [{ word: "大使館" }, { word: "行き" }] },
      { title: "其他（課本表以外）", words: [{ word: "おまけ" }] },
    ]);
  });
  it("keeps everything in one untitled group without an index", () => {
    expect(groupBySection([{ word: "a" }], [])).toEqual([{ title: "", words: [{ word: "a" }] }]);
  });
});
