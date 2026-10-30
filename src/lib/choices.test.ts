import { describe, expect, it } from "vitest";
import { choiceQuestion, nearReadings } from "./choices";
import type { N3WordItem, VocabItem } from "./types";

const vocab = (id: string, word: string, reading: string, meaning: string, lang: "ja" | "en" = "ja") =>
  ({ kind: "vocab", id, word, reading, meaning, lang, examples: [] }) as unknown as VocabItem;

describe("nearReadings", () => {
  it("makes three different look-alike readings", () => {
    const r = nearReadings("しゃしん");
    expect(r).toHaveLength(3);
    expect(new Set(r).size).toBe(3);
    expect(r).not.toContain("しゃしん");
    // 都是只改一兩個地方的讀法
    for (const x of r) expect(Math.abs([...x].length - 4)).toBeLessThanOrEqual(2);
  });
  it("includes the small/large kana swap", () => {
    expect(nearReadings("しゃしん", "x").concat(nearReadings("しゃしん", "y"), nearReadings("しゃしん", "z"))).toContain("しやしん");
  });
});

describe("choiceQuestion", () => {
  it("asks for the reading of a kanji word", () => {
    const q = choiceQuestion(vocab("a", "写真", "しゃしん", "照片"), []);
    expect(q?.ask).toBe("選出正確的讀音");
    expect(q?.options).toContain("しゃしん");
    expect(q?.options).toHaveLength(4);
  });
  it("asks for the meaning of an English word, using other words as distractors", () => {
    const pool = [vocab("e1", "lift", "/lɪft/", "電梯", "en"), vocab("e2", "boot", "/buːt/", "後車廂", "en"), vocab("e3", "flat", "/flæt/", "公寓；平的", "en"), vocab("e4", "lorry", "/ˈlɔːri/", "卡車", "en")];
    const q = choiceQuestion(pool[2], pool);
    expect(q?.answer).toBe("公寓");
    expect(q?.options.sort()).toEqual(["公寓", "卡車", "後車廂", "電梯"].sort());
  });
  it("falls back to fill-in when there are too few other words", () => {
    expect(choiceQuestion(vocab("k", "ネギ", "ねぎ", "蔥"), [])).toBeNull();
  });
  it("works for N3 words", () => {
    const n3 = { kind: "n3", id: "n", word: "経験", reading: "けいけん", meaning: "經驗" } as unknown as N3WordItem;
    expect(choiceQuestion(n3, [])?.options).toContain("けいけん");
  });
});
