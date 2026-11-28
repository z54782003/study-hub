import { describe, expect, it } from "vitest";
import { blankExample, checkListen, listenQuestion, wordAnswers } from "./listen";
import type { VocabItem } from "./types";

const audio = { url: "u", expires: null, fallback: "f" };
const vocab = (o: Partial<VocabItem>): VocabItem => ({
  kind: "vocab",
  id: "v",
  word: "図書館",
  reading: "としょかん",
  meaning: "圖書館",
  pos: null,
  usage: "",
  examples: [],
  lesson: null,
  lang: "ja",
  status: null,
  right: 0,
  wrong: 0,
  ...o,
});

describe("wordAnswers", () => {
  it("accepts each reading and the word itself", () => {
    expect(wordAnswers({ word: "人", reading: "ひと／にん" })).toEqual(["ひと", "にん", "人"]);
    expect(wordAnswers({ word: "スピード", reading: "" })).toEqual(["スピード"]);
  });
  it("expands textbook notation", () => {
    expect(wordAnswers({ word: "(お)正月", reading: "(お)しょうがつ" })).toEqual(expect.arrayContaining(["しょうがつ", "おしょうがつ"]));
    expect(wordAnswers({ word: "ヒット・する", reading: "ヒット・する" })).toEqual(expect.arrayContaining(["ヒットする", "ヒット"]));
    expect(wordAnswers({ word: "嫌(な)", reading: "いや(な)" })).toEqual(expect.arrayContaining(["いや", "いやな"]));
    expect(wordAnswers({ word: "七", reading: "しち・なな" })).toEqual(expect.arrayContaining(["しち", "なな"]));
    expect(wordAnswers({ word: "火", reading: "ひ（訓讀み）・か（曜日）" })).toEqual(expect.arrayContaining(["ひ", "か"]));
  });
});

describe("blankExample", () => {
  it("blanks the word and uses its furigana as the answer", () => {
    const q = blankExample(vocab({ examples: [{ ja: "毎日、図書館（としょかん）で勉強（べんきょう）します。", zh: "", audio }] }))!;
    expect(q.answer).toBe("としょかん");
    expect(q.before.map((p) => p.text).join("")).toBe("毎日、");
    expect(q.after.map((p) => p.text).join("")).toBe("で勉強します。");
  });
  it("skips sentences where the word is conjugated or has no audio", () => {
    const v = vocab({ word: "借りる", reading: "かりる" });
    expect(blankExample({ ...v, examples: [{ ja: "本を借（か）ります。", zh: "", audio }] })).toBeNull();
    expect(blankExample(vocab({ examples: [{ ja: "図書館（としょかん）です。", zh: "" }] }))).toBeNull();
  });
});

describe("listenQuestion", () => {
  const v = vocab({ audio, examples: [{ ja: "図書館（としょかん）です。", zh: "", audio }] });
  it("alternates word / blank", () => {
    expect(listenQuestion(v, 0)?.type).toBe("word");
    expect(listenQuestion(v, 1)?.type).toBe("blank");
    expect(listenQuestion({ ...v, audio: undefined }, 0)?.type).toBe("blank");
    expect(listenQuestion({ ...v, audio: undefined, examples: [] }, 0)).toBeNull();
  });
  it("checks long vowels strictly", () => {
    const q = listenQuestion(vocab({ word: "東京", reading: "とうきょう", audio }), 0)!;
    expect(checkListen(q, "とうきょう")).toBe(true);
    expect(checkListen(q, "東京")).toBe(true);
    expect(checkListen(q, "ときょう")).toBe(false);
    expect(checkListen(q, "トウキョウ")).toBe(false);
  });
});
