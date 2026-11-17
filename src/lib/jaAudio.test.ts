import { describe, expect, it } from "vitest";
import {
  canonMoras,
  finishSentence,
  FIXED_READINGS,
  kanaMoras,
  keepOneHits,
  misalignedSegments,
  notation,
  parseSentence,
  planSentence,
  planWord,
  readingCount,
  sentenceInput,
  splitMoras,
  wordInput,
  type EnginePhrase,
} from "./jaAudio";
import { SPECIAL_WORDS, WORD_KANA_WORDS } from "./speech";

/** 假的引擎回傳：「キョ'ー/ワ」→ 每個「/」一個重音句，' 標核（沒標＝平板） */
const eng = (s: string): EnginePhrase[] =>
  s.split("/").map((p) => {
    const moras = splitMoras(p.replace(/'/g, ""));
    const at = p.indexOf("'");
    return { moras: moras.map((text) => ({ text })), accent: at < 0 ? moras.length : splitMoras(p.slice(0, at)).length };
  });

describe("kana", () => {
  it("splits morae and folds long vowels the same way on both sides", () => {
    expect(splitMoras("キョートショ")).toEqual(["キョ", "ー", "ト", "ショ"]);
    expect(canonMoras(splitMoras("センセー"))).toEqual(kanaMoras("せんせい"));
    expect(canonMoras(splitMoras("トーキョー"))).toEqual(kanaMoras("とうきょう"));
    expect(kanaMoras("おもう")).toEqual(canonMoras(splitMoras("オモウ")));
  });
  it("writes the accent like AquesTalk", () => {
    expect(notation(["ア", "メ"], 1)).toBe("ア'メ");
    expect(notation(["ハ", "シ"], 2)).toBe("ハシ'");
  });
});

describe("words", () => {
  it("cleans the word for the engine and skips 〜 words", () => {
    expect(wordInput("駐車・する")).toBe("駐車する");
    expect(wordInput("丈夫(な)")).toBe("丈夫");
    expect(wordInput("火（漢字）")).toBe("火");
    expect(wordInput("おかわり")).toBe("お代わり");
    expect(wordInput("〜日")).toBeNull();
  });
  it("counts readings", () => {
    expect(readingCount("なん／なに")).toBe(2);
    expect(readingCount("ひ（訓讀み）・か（曜日）")).toBe(2);
    expect(readingCount("しょうしょうおまちください")).toBe(1);
    expect(readingCount("よみます（読む）")).toBe(1);
  });
  it("accepts the engine when reading and pitch agree", () => {
    const p = planWord({ word: "速い", reading: "はやい", pitch: 2 }, eng("ハヤ'イ"));
    expect(p).toMatchObject({ verdict: "一致", override: false, accent: 2, engineAccent: 2 });
  });
  it("overrides pitch with 聲調 (0 = 平板 = mora count in VOICEVOX)", () => {
    const p = planWord({ word: "飴", reading: "あめ", pitch: 0 }, eng("ア'メ"));
    expect(p).toMatchObject({ verdict: "已用我的資料覆蓋", override: true, accent: 2 });
  });
  it("overrides a wrong reading; no 聲調 means 需抽查", () => {
    const p = planWord({ word: "今日", reading: "きょう", pitch: null }, eng("コ'ンニチ"));
    expect(p).toMatchObject({ verdict: "聲調沒填需抽查", override: true, accent: null });
    expect(p.note).toContain("コンニチ");
    expect(planWord({ word: "今日", reading: "きょう", pitch: 1 }, eng("コ'ンニチ")).verdict).toBe("已用我的資料覆蓋");
  });
  it("uses the first reading of multi-reading words and flags them", () => {
    const p = planWord({ word: "何", reading: "なん／なに", pitch: 1 }, eng("ナ'ニ"));
    expect(p).toMatchObject({ verdict: "需抽查（多讀音，用第一個）", kana: "なん", override: true });
  });
  it("forces one accent phrase when the engine splits a word that has 聲調", () => {
    const p = planWord({ word: "履歴書", reading: "りれきしょ", pitch: 0 }, eng("リレキ/ショ'"));
    expect(p.override).toBe(true);
  });
});

describe("sentences", () => {
  it("splits ruby, kana, unknown kanji and drops stage directions", () => {
    const segs = parseSentence("（ノックして）失礼（しつれい）します。");
    expect(segs.map((s) => s.kind)).toEqual(["ruby", "kana", "punct"]);
    expect(sentenceInput(segs)).toBe("失礼します。");
    const odd = parseSentence("社長（しゃちょう）が3時（じ）に来ます。");
    expect(odd.find((s) => s.kind === "other" && s.unknownKanji)).toMatchObject({ text: "来" });
  });
  it("fills unannotated table words but not ambiguous ones", () => {
    const segs = parseSentence("今日は明日の話です。");
    expect(segs[0]).toMatchObject({ kind: "ruby", base: "今日", reading: "きょう", from: "讀音表" });
    expect(segs.find((s) => s.kind === "other" && s.text.startsWith("明日"))).toBeTruthy();
  });
  it("matches when the engine reads it like the furigana (particles, long vowels, numbers)", () => {
    const segs = parseSentence("社長（しゃちょう）は3時（じ）にいらっしゃいます。");
    const plan = planSentence(segs, eng("シャ'チョーワ/サ'ンジニ/イラッシャイマ'ス"));
    expect(plan.verdict).toBe("一致");
    expect(finishSentence(segs, plan, eng("シャ'チョーワ/サ'ンジニ/イラッシャイマ'ス")).verdict).toBe("一致");
  });
  it("sends the furigana for the word the engine misreads", () => {
    const segs = parseSentence("「明日（あした）は休（やす）みだ」と聞（き）いて、うれしくなりました。");
    const first = eng("ア'スワ/ヤスミダ'ト/キ'イテ/ウレ'シクナリマシタ");
    const plan = planSentence(segs, first);
    expect([...plan.override].map((i) => (segs[i] as { base: string }).base)).toEqual(["明日"]);
    expect(sentenceInput(segs, plan.override)).toBe("「アシタは休みだ」と聞いて、うれしくなりました。");
    const done = finishSentence(segs, plan, eng("アシタ'ワ/ヤスミダ'ト/キ'イテ/ウレ'シクナリマシタ"));
    expect(done).toMatchObject({ verdict: "已用我的資料覆蓋" });
    expect(done.note).toContain("明日（あした）");
  });
  it("flags kana that still do not match", () => {
    const segs = parseSentence("辞書（じしょ）は棚（たな）の上（うえ）にあります。");
    const engine = eng("ジ'ショワ/タナノ/ウエニ/アリマ'ス");
    expect(misalignedSegments(segs, engine).size).toBe(0);
    const wrong = eng("ジ'ショワ/タナノ/ウエデ/アリマ'ス");
    expect(finishSentence(segs, planSentence(segs, wrong), wrong).verdict).toBe("需抽查");
  });
  it("lists the old KEEP_ONE spots", () => {
    expect(keepOneHits(parseSentence("「明日（あした）は休（やす）みだ」と聞（き）いて、うれしくなりました。"))).toEqual(["と聞（き）いて"]);
    expect(keepOneHits(parseSentence("辞書（じしょ）は棚（たな）の上（うえ）にあります。"))).toEqual(["は棚（たな）の"]);
  });
});

describe("fixed readings", () => {
  it("covers every SPECIAL and WORD_KANA word from speech.ts", () => {
    for (const w of [...SPECIAL_WORDS, ...WORD_KANA_WORDS]) expect(FIXED_READINGS, w).toHaveProperty(w);
  });
});
