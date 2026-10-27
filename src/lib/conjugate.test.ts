import { describe, expect, it } from "vitest";
import { checkConjugation, conjugate, groupRule, formException, isIRowIchidan, looksLikeIchidan, parseVerb, specialNote, type VerbClass, type VerbForm } from "./conjugate";

const v = (dict: string, reading: string, cls: VerbClass) => ({ dict, reading, cls });
const word = (verb: ReturnType<typeof v>, form: VerbForm) => conjugate(verb, form)?.word;

describe("parseVerb", () => {
  it("reads the three spellings in the vocab DB", () => {
    expect(parseVerb("読む", "よむ", "五段")).toEqual({ dict: "読む", reading: "よむ", cls: "五段" });
    expect(parseVerb("読みます", "よみます（読む）", "五段")).toEqual({ dict: "読む", reading: "よむ", cls: "五段" });
    expect(parseVerb("働きます［働く］", "はたらきます［はたらく］", "五段")).toEqual({ dict: "働く", reading: "はたらく", cls: "五段" });
    expect(parseVerb("食べます", "たべます（食べる）", "一段")).toEqual({ dict: "食べる", reading: "たべる", cls: "一段" });
    expect(parseVerb("勉強します［勉強する］", "べんきょうします［べんきょうする］", "サ変")).toEqual({
      dict: "勉強する",
      reading: "べんきょうする",
      cls: "サ変",
    });
    expect(parseVerb("来ます", "きます（来る）", "カ変")).toEqual({ dict: "来る", reading: "くる", cls: "カ変" });
    expect(parseVerb("します", "します（する）", "サ変")).toEqual({ dict: "する", reading: "する", cls: "サ変" });
  });
  it("reads the other spellings found in the DB", () => {
    expect(parseVerb("入ります", "はいります（辭書形：入る）", "五段")).toEqual({ dict: "入る", reading: "はいる", cls: "五段" });
    expect(parseVerb("歌います", "うたいます（辞書形：うたう）", "五段")).toEqual({ dict: "歌う", reading: "うたう", cls: "五段" });
    expect(parseVerb("遊びます［遊ぶ］", "あそびます／あそぶ", "五段")).toEqual({ dict: "遊ぶ", reading: "あそぶ", cls: "五段" });
    expect(parseVerb("ふる（振る）", "ふる", "五段")).toEqual({ dict: "振る", reading: "ふる", cls: "五段" });
    expect(parseVerb("降ります［降る］", "ふります", "五段")).toEqual({ dict: "降る", reading: "ふる", cls: "五段" });
    expect(parseVerb("持って来ます", "もってきます（辞書形：もってくる）", "カ変")).toEqual({ dict: "持って来る", reading: "もってくる", cls: "カ変" });
    expect(parseVerb("風邪をひきます", "かぜをひきます", "五段")).toEqual({ dict: "風邪をひく", reading: "かぜをひく", cls: "五段" });
  });
  it("handles katakana サ変, missing する in the reading, and mislabelled 〜てくる", () => {
    expect(parseVerb("リサイクルします", "リサイクルします", "サ変")).toEqual({ dict: "リサイクルする", reading: "リサイクルする", cls: "サ変" });
    expect(parseVerb("配達する", "はいたつ", "サ変")).toEqual({ dict: "配達する", reading: "はいたつする", cls: "サ変" });
    expect(parseVerb("入ってくる", "はいってくる", "五段")).toEqual({ dict: "入ってくる", reading: "はいってくる", cls: "カ変" });
    expect(parseVerb("はく", "はく（はきます）", "五段")?.reading).toBe("はく");
    expect(parseVerb("売る", "うる（売ります）", "五段")?.reading).toBe("うる");
  });
  it("adds する to サ変 nouns", () => expect(parseVerb("把握", "はあく", "サ変")).toEqual({ dict: "把握する", reading: "はあくする", cls: "サ変" }));
  it("rejects readings that are not kana", () => expect(parseVerb("読む", "yomu", "五段")).toBeNull());
});

describe("conjugate", () => {
  const kaku = v("書く", "かく", "五段");
  const taberu = v("食べる", "たべる", "一段");
  const benkyou = v("勉強する", "べんきょうする", "サ変");
  const kuru = v("来る", "くる", "カ変");

  it("G1", () => {
    expect([...(["ます", "ない", "て", "た", "可能", "意向", "條件", "受身", "命令", "禁止"] as const)].map((f) => word(kaku, f))).toEqual([
      "書きます", "書かない", "書いて", "書いた", "書ける", "書こう", "書けば", "書かれる", "書け", "書くな",
    ]);
  });
  it("G2", () => {
    expect((["ます", "ない", "て", "可能", "意向", "條件", "命令"] as const).map((f) => word(taberu, f))).toEqual([
      "食べます", "食べない", "食べて", "食べられる", "食べよう", "食べれば", "食べろ",
    ]);
  });
  it("G3", () => {
    expect((["ます", "ない", "可能", "意向", "受身"] as const).map((f) => word(benkyou, f))).toEqual([
      "勉強します", "勉強しない", "勉強できる", "勉強しよう", "勉強される",
    ]);
    expect((["ます", "ない", "て", "可能", "意向", "條件", "命令"] as const).map((f) => conjugate(kuru, f))).toEqual([
      { word: "来ます", reading: "きます" },
      { word: "来ない", reading: "こない" },
      { word: "来て", reading: "きて" },
      { word: "来られる", reading: "こられる" },
      { word: "来よう", reading: "こよう" },
      { word: "来れば", reading: "くれば" },
      { word: "来い", reading: "こい" },
    ]);
    expect(word(v("持って来る", "もってくる", "カ変"), "て")).toBe("持って来て");
  });
  it("て形 sound changes and exceptions", () => {
    const te = (d: string, r: string) => word(v(d, r, "五段"), "て");
    expect([te("買う", "かう"), te("待つ", "まつ"), te("帰る", "かえる"), te("飲む", "のむ"), te("遊ぶ", "あそぶ"), te("死ぬ", "しぬ")]).toEqual([
      "買って", "待って", "帰って", "飲んで", "遊んで", "死んで",
    ]);
    expect([te("急ぐ", "いそぐ"), te("話す", "はなす"), te("行く", "いく")]).toEqual(["急いで", "話して", "行って"]);
    expect(word(v("行く", "いく", "五段"), "た")).toBe("行った");
    expect(word(v("泳ぐ", "およぐ", "五段"), "た")).toBe("泳いだ");
  });
  it("う→わ, ある→ない, honorific godan", () => {
    expect(word(v("買う", "かう", "五段"), "ない")).toBe("買わない");
    expect(word(v("言う", "いう", "五段"), "受身")).toBe("言われる");
    expect(word(v("ある", "ある", "五段"), "ない")).toBe("ない");
    expect(word(v("いらっしゃる", "いらっしゃる", "五段"), "ます")).toBe("いらっしゃいます");
  });
  it("volitional of verbs that look like G2 but are G1", () => {
    expect(word(v("帰る", "かえる", "五段"), "意向")).toBe("帰ろう");
    expect(word(v("見る", "みる", "一段"), "意向")).toBe("見よう");
  });
  it("honorific verbs", () => {
    expect(conjugate(v("食べる", "たべる", "一段"), "尊敬")).toEqual({ word: "召し上がる", reading: "めしあがる" });
    expect(conjugate(kaku, "尊敬")).toBeNull();
  });
});

describe("checkConjugation", () => {
  it("accepts kanji or kana, ignores spaces", () => {
    const right = { word: "書こう", reading: "かこう" };
    expect(checkConjugation("かこう", right)).toBe(true);
    expect(checkConjugation(" 書こう ", right)).toBe(true);
    expect(checkConjugation("書こ", right)).toBe(false);
  });
});

describe("special verbs", () => {
  const v = (reading: string, cls: VerbClass) => ({ reading, cls });
  it("finds い段 G2 and G1 verbs that look like G2", () => {
    expect(["みる", "おきる", "かりる", "いる", "きる", "できる"].map((r) => isIRowIchidan(v(r, "一段")))).toEqual([true, true, true, true, true, true]);
    expect(isIRowIchidan(v("たべる", "一段"))).toBe(false);
    expect(["かえる", "はいる", "しる", "はしる", "きる"].map((r) => looksLikeIchidan(v(r, "五段")))).toEqual([true, true, true, true, true]);
    expect(looksLikeIchidan(v("つくる", "五段"))).toBe(false);
  });
  it("notes form exceptions", () => {
    expect(formException(v("いく", "五段"), "て")).toContain("行って");
    expect(formException(v("いく", "五段"), "意向")).toBeNull();
    expect(formException(v("ある", "五段"), "ない")).toContain("ない");
    expect(formException(v("かう", "五段"), "ない")).toContain("わ");
    expect(specialNote(v("かえる", "五段"), "意向")).toBe("長得像 G2，其實是 G1");
    expect(specialNote(v("みる", "一段"), "意向")).toBe("い段＋る 的 G2");
    expect(specialNote(v("かく", "五段"), "意向")).toBeNull();
  });
});

describe("groupRule", () => {
  it("keeps only the chosen group's part of the rule", () => {
    expect(groupRule("て", "G1")).toEqual(["う・つ・る→って", "む・ぶ・ぬ→んで", "く→いて", "ぐ→いで", "す→して（行く→行って）"]);
    expect(groupRule("ない", "G1")).toEqual(["う段→あ段＋ない（う→わ：買う→買わない）", "ある→ない"]);
    expect(groupRule("ない", "G3")).toEqual(["しない・こない"]);
  });
  it("returns ungrouped rules whole", () => {
    expect(groupRule("た", "G2")).toEqual(["て形的て→た、で→だ"]);
  });
});
