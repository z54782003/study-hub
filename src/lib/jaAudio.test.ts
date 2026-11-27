import { describe, expect, it } from "vitest";
import {
  canonMoras,
  contourText,
  finishSentence,
  highMoras,
  FIXED_READINGS,
  kanaMoras,
  keepOneHits,
  misalignedSegments,
  notation,
  parseSentence,
  PITCH_FALL,
  PITCH_RISE,
  planSentence,
  rubyBeforeMisaligned,
  planWord,
  readingCount,
  sentenceInput,
  shapePitch,
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
    expect(readingCount("けんか・する")).toBe(1);
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
  it("accepts いう pronounced ユー (どういう、という)", () => {
    const segs = parseSentence("どういう意味（いみ）ですか");
    expect(misalignedSegments(segs, eng("ドーユー/イ'ミデスカ")).size).toBe(0);
    expect(misalignedSegments(segs, eng("ドーイウ/イ'ミデスカ")).size).toBe(0);
    expect(misalignedSegments(parseSentence("田中（たなか）という人（ひと）"), eng("タナカト/イウ/ヒト'")).size).toBe(0);
  });
  it("points at the kanji when the engine swallows the okurigana", () => {
    const segs = parseSentence("冷（ひ）やす");
    const still = misalignedSegments(segs, eng("ヒエヤ'ス"));
    expect(rubyBeforeMisaligned(segs, still, new Set())).toEqual([0]);
    const quiet = parseSentence("静（しず）か");
    expect(rubyBeforeMisaligned(quiet, misalignedSegments(quiet, eng("シズ'カカ")), new Set())).toEqual([0]);
    expect(misalignedSegments(segs, eng("ヒヤ'ス")).size).toBe(0);
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

describe("pitch shaping", () => {
  it("follows Tokyo accent: ⓪ low then high to the end, ① high then low, ② low-high-low…", () => {
    const hl = (n: number, p: number) => highMoras(n, p).map((h) => (h ? "H" : "L")).join("");
    expect(hl(5, 0)).toBe("LHHHH"); // できあがり⓪
    expect(hl(2, 1)).toBe("HL"); // 雨①
    expect(hl(2, 0)).toBe("LH"); // 飴⓪
    expect(hl(2, 2)).toBe("LH"); // 橋②：單獨唸和平板一樣
    expect(hl(4, 2)).toBe("LHLL"); // 中高型：第二拍之後下降
    expect(hl(3, 9)).toBe("LHH"); // 聲調超過拍數 → 當尾高
  });
  it("keeps the plateau flat (no final dip) and makes the falls clear", () => {
    // VOICEVOX 給的：できあがり⓪ 詞尾往下滑
    const out = shapePitch([5.62, 5.9, 5.98, 5.95, 5.77], 0);
    expect(out[0]).toBeCloseTo(5.98 - PITCH_RISE);
    expect(out.slice(1)).toEqual([5.98, 5.98, 5.98, 5.98]);
    // 雨①：引擎幾乎不降 → 第二拍低 PITCH_FALL
    const ame = shapePitch([5.81, 5.8], 1);
    expect(ame[0]).toBe(5.81);
    expect(ame[1]).toBeCloseTo(5.81 - PITCH_FALL);
  });
  it("leaves unvoiced morae (pitch 0) alone", () => {
    expect(shapePitch([5.6, 0, 5.9, 5.8], 0)).toEqual([5.9 - PITCH_RISE, 0, 5.9, 5.9]);
    expect(shapePitch([0, 0], 1)).toEqual([0, 0]);
    expect(contourText([5.6, 0, 5.9, 5.8], 0)).toBe("低無高高");
  });
});
