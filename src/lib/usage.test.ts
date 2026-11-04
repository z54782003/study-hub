import { describe, expect, it } from "vitest";
import { glossParts, kanaOnly, markWord, masuRuby, splitMasu, parseUsage, usageSpeech, verbType } from "./usage";

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
    expect(usageSpeech("ちょっと〜にくい")).toBe("ちょっと、にくい");
    expect(usageSpeech("〜やすい")).toBe("やすい");
    expect(usageSpeech("↔ 厚（あつ）い・濃（こ）い")).toBe("厚（あつ）い、濃（こ）い");
    expect(usageSpeech("落（お）ちる（自）・歯医者（はいしゃ）（牙醫）")).toBe("落（お）ちる、歯医者（はいしゃ）");
  });
});

describe("splitMasu", () => {
  it("takes the ます形 line out of the usage", () => {
    expect(splitMasu("ます形：行きます\n・搭配：学校（がっこう）へ行（い）く：去學校")).toEqual({ masu: "行きます", rest: "・搭配：学校（がっこう）へ行（い）く：去學校" });
    expect(splitMasu("・⚠️ます形：生（う）まれます\n・搭配：子（こ）どもが生（う）まれる：孩子出生")).toEqual({ masu: "生（う）まれます", rest: "・搭配：子（こ）どもが生（う）まれる：孩子出生" });
    expect(splitMasu("・搭配：本（ほん）を読（よ）む：讀書")).toEqual({ masu: null, rest: "・搭配：本（ほん）を読（よ）む：讀書" });
  });
});

describe("masuRuby", () => {
  it("adds the reading of the kanji from the word and its reading", () => {
    expect(masuRuby("決めます", "決める", "きめる")).toBe("決（き）めます");
    expect(masuRuby("勉強します", "勉強する", "べんきょうする")).toBe("勉強（べんきょう）します");
    expect(masuRuby("風邪をひきます", "風邪をひく", "かぜをひく")).toBe("風邪（かぜ）をひきます");
    expect(masuRuby("来ます", "来る", "くる")).toBe("来（き）ます");
  });
  it("leaves it alone when it already has a reading or can't be worked out", () => {
    expect(masuRuby("生（う）まれます", "生まれる", "うまれる")).toBe("生（う）まれます");
    expect(masuRuby("持って行きます", "持って行く", "もっていく")).toBe("持って行きます");
    expect(masuRuby("あげます", "あげる", "あげる")).toBe("あげます");
  });
});

describe("kanaOnly", () => {
  it("is true only for words written in kana", () => {
    expect(["やめる", "パーティー", "メジャー(な)", "シュート・する", "あれ？", "〜ずつ"].map(kanaOnly)).toEqual([true, true, true, true, true, true]);
    expect(["開く", "おせち料理", "ATM", "ビタミンC", "〜日"].map(kanaOnly)).toEqual([false, false, false, false, false]);
  });
});

describe("verbType", () => {
  it("moves the 自動詞／他動詞 note out of the meaning", () => {
    expect(verbType("開、被打開(自動詞)")).toEqual({ meaning: "開、被打開", type: "自動詞" });
    expect(verbType("弄髒（他動詞）")).toEqual({ meaning: "弄髒", type: "他動詞" });
    expect(verbType("自動鉛筆")).toEqual({ meaning: "自動鉛筆", type: null });
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
