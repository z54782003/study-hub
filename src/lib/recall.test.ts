import { describe, expect, it } from "vitest";
import { recallMode, recallQuestion, sameAsChinese, type RecallItem } from "./recall";

describe("recallQuestion", () => {
  it("asks either the reading or the meaning of a kanji word, not both", () => {
    const v: RecallItem = { kind: "vocab", id: "v", word: "目標", reading: "もくひょう", meaning: "想達成的方向", pos: null, usage: "", examples: [], lesson: null, lang: "ja", status: null, right: 0, wrong: 0 };
    expect(recallQuestion(v, "reading")).toMatchObject({ ask: "寫出讀音（平假名）", reference: "讀音：もくひょう" });
    expect(recallQuestion(v, "meaning")).toMatchObject({ ask: "寫出中文意思", reference: "意思：想達成的方向" });
  });
  it("keeps the same kind of question all day and switches the next day", () => {
    expect(recallMode("abc", 100)).toBe(recallMode("abc", 100));
    expect(recallMode("abc", 100)).not.toBe(recallMode("abc", 101));
  });
  it("asks only the meaning for a kana word or an English word", () => {
    expect(recallQuestion({ kind: "n3", id: "n", word: "やっぱり", reading: "やっぱり", meaning: "果然", pos: null, note: "", level: null, status: null, source: "due" }).ask).toBe("寫出中文意思");
    expect(recallQuestion({ kind: "vocab", id: "e", word: "habit", reading: "", meaning: "習慣", pos: null, usage: "", examples: [], lesson: null, lang: "en", status: null, right: 0, wrong: 0 }).cueLang).toBe("en");
  });
  it("gives the kanji readings to the grader", () => {
    const q = recallQuestion({ kind: "kanji", id: "k", kanji: "歌", on: "カ", kun: "うた・うた.う", meaning: "歌；唱", examples: [], chapter: null, status: null, hint: "", confusable: "" } as never);
    expect(q.reference).toBe("音読み：カ／訓読み：うた・うた.う／意思：歌；唱");
  });
});

describe("sameAsChinese", () => {
  it("is true when the Chinese meaning already shows the same kanji", () => {
    expect(sameAsChinese("夢", "夢想；夢")).toBe(true);
    expect(sameAsChinese("学生証", "學生證")).toBe(true);
    expect(sameAsChinese("丈夫(な)", "堅固、耐用")).toBe(false);
    expect(sameAsChinese("やめる", "放棄")).toBe(false);
  });
  it("asks the reading for such words", () => {
    const v: RecallItem = { kind: "vocab", id: "v", word: "夢", reading: "ゆめ", meaning: "夢想；夢", pos: null, usage: "", examples: [], lesson: null, lang: "ja", status: null, right: 0, wrong: 0 };
    expect(recallQuestion(v, "meaning").ask).toBe("寫出讀音（平假名）");
  });
});
