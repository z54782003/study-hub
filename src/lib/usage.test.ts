import { describe, expect, it } from "vitest";
import { glossParts, markWord, parseUsage, usageSpeech } from "./usage";

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
  it("keeps the loanword origin line whole", () => {
    expect(parseUsage("・搭配：アクセサリーをつける：戴飾品\n・語源：英語 accessory（配件）")).toEqual([
      { ja: "アクセサリーをつける", zh: "戴飾品" },
      { ja: "語源：英語 accessory（配件）", zh: "", note: true },
    ]);
  });
  it("reads a single dash as the separator, but not the long-vowel mark", () => {
    expect(parseUsage("・搭配：サークルに入（はい）る—加入社團\n・搭配：サークル活動（かつどう）—社團活動")).toEqual([
      { ja: "サークルに入（はい）る", zh: "加入社團" },
      { ja: "サークル活動（かつどう）", zh: "社團活動" },
    ]);
  });
  it("keeps 「／」 inside a 「・」 line instead of splitting it into extra phrases", () => {
    expect(
      parseUsage("・搭配：先生（せんせい）に相談（そうだん）する—向老師商量／諮詢\n・搭配：天気（てんき）がいい／悪（わる）い—天氣好／不好\n・⚠️相關：↔ 厚（あつ）い／濃（こ）い"),
    ).toEqual([
      { ja: "先生（せんせい）に相談（そうだん）する", zh: "向老師商量／諮詢" },
      { ja: "天気（てんき）がいい／悪（わる）い", zh: "天氣好／不好" },
      { ja: "相關：↔ 厚（あつ）い／濃（こ）い", zh: "", note: true },
    ]);
  });
  it("keeps ⚠️ reminders whole, colons included", () => {
    expect(parseUsage("・搭配：〜を楽（たの）しむ：享受〜\n・⚠️相關：楽（たの）しい（い形）\n・搭配：⚠️ 直接稱呼時用「先生」")).toEqual([
      { ja: "〜を楽（たの）しむ", zh: "享受〜" },
      { ja: "相關：楽（たの）しい（い形）", zh: "", note: true },
      { ja: "直接稱呼時用「先生」", zh: "", note: true },
    ]);
  });
});

describe("glossParts", () => {
  it("separates Chinese notes in brackets from readings", () => {
    expect(glossParts("落（お）ちる（自）・歯医者（はいしゃ）（牙醫）")).toEqual([
      { text: "落（お）ちる", zh: false },
      { text: "（自）", zh: true },
      { text: "・歯医者（はいしゃ）", zh: false },
      { text: "（牙醫）", zh: true },
    ]);
  });
});

describe("usageSpeech", () => {
  it("keeps only the Japanese to read aloud", () => {
    expect(usageSpeech("〈人（ひと）〉を〜に招待（しょうたい）する")).toBe("人（ひと）を招待（しょうたい）する");
    expect(usageSpeech("〜のが苦手（にがて）だ")).toBe("苦手（にがて）だ");
    expect(usageSpeech("↔ 厚（あつ）い・濃（こ）い")).toBe("厚（あつ）い、濃（こ）い");
    expect(usageSpeech("落（お）ちる（自）・歯医者（はいしゃ）（牙醫）")).toBe("落（お）ちる、歯医者（はいしゃ）");
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
