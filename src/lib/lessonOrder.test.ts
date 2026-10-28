import { describe, expect, it } from "vitest";
import { groupBySection, sectionTitle } from "./lessonOrder";

describe("lesson vocab order", () => {
  it("cleans section headings", () => {
    expect(sectionTitle("4-1｜生活を楽しむ（p.56–59）")).toBe("4-1 生活を楽しむ");
    expect(sectionTitle("補｜話読聞書・もう一度聞こう（p.64・66）")).toBe("補 話読聞書・もう一度聞こう");
  });
  it("sorts words by textbook order; 補 and words outside the table become 補充", () => {
    const sections = [
      { title: "4-1 生活を楽しむ", words: ["美容院", "空港", "質問・する", "必要(な)"] },
      { title: "4-2 行き方を教える", words: ["大使館", "〜行き"] },
      { title: "補 話読聞書・もう一度聞こう", words: ["味", "中学校"] },
    ];
    const words = ["中学校", "行き", "必要", "大使館", "おまけ", "美容院", "質問する", "味"].map((word) => ({ word }));
    expect(groupBySection(words, sections)).toEqual([
      { title: "4-1", words: [{ word: "美容院" }, { word: "質問する" }, { word: "必要" }] },
      { title: "4-2", words: [{ word: "大使館" }, { word: "行き" }] },
      { title: "補充", words: [{ word: "味" }, { word: "中学校" }, { word: "おまけ" }] },
    ]);
  });
  it("keeps everything in one untitled group without an index", () => {
    expect(groupBySection([{ word: "a" }], [])).toEqual([{ title: "", words: [{ word: "a" }] }]);
  });
});
