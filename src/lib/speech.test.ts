import { describe, expect, it } from "vitest";
import { speakableJa, stripReadings } from "./speech";

describe("speakableJa", () => {
  it("cleans the reading formats in the DBs", () => {
    expect(speakableJa("よみます（読む）")).toBe("よみます");
    expect(speakableJa("はたらきます［はたらく］")).toBe("はたらきます");
    expect(speakableJa("あそびます／あそぶ")).toBe("あそびます");
    expect(speakableJa("う.まれる・い.きる")).toBe("うまれる");
    expect(speakableJa("〜じゅう")).toBe("じゅう");
  });
  it("falls back to the word when there is no reading", () => expect(speakableJa("", "～才")).toBe("才"));
  it("says multi-kanji words as written so the voice gets the word right", () => {
    expect(speakableJa("ちゅうしゃ", "駐車・する")).toBe("駐車する");
    expect(speakableJa("しょうがっこう", "小学校")).toBe("小学校");
    expect(speakableJa("きょう", "今日")).toBe("きょう");
    expect(speakableJa("かよう", "通う")).toBe("かよう");
    expect(speakableJa("おみやげ", "お土産")).toBe("おみやげ");
    expect(speakableJa("おこのみやき", "お好み焼き")).toBe("お好み焼き");
  });
});

describe("stripReadings", () => {
  it("reads marked kanji by their furigana, once", () => {
    expect(stripReadings("明日は大事な面接（めんせつ）があるので、今日美容院で髪を切りました。")).toBe("明日は大事な面接があるので、今日美容院で髪を切りました。");
    expect(stripReadings("弟（おとうと）は小学校（しょうがっこう）に通（かよ）っています。")).toBe("おとうとわ小学校にかよっています。");
  });
  it("writes the particles は／へ after a reading the way they sound", () => {
    expect(stripReadings("電車（でんしゃ）は午後（ごご）三時（さんじ）に駅（えき）に着（つ）きます。")).toBe("電車は午後三時にえきにつきます。");
    expect(stripReadings("この時計（とけい）は五分（ごふん）遅（おく）れて止（と）まりました。")).toBe("この時計は五分おくれてとまりました。");
    expect(stripReadings("学校（がっこう）へ行（い）きます。")).toBe("学校へいきます。");
    expect(stripReadings("早（はや）く")).toBe("はやく");
    expect(stripReadings("駅（えき）へ行（い）きます。")).toBe("えきえいきます。");
    expect(stripReadings("今日（きょう）は")).toBe("きょうわ");
  });
  it("keeps a word with several furigana'd kanji whole", () => {
    expect(stripReadings("お好（この）み焼（や）きを食（た）べました。")).toBe("お好み焼きをたべました。");
    expect(stripReadings("髪（かみ）の毛（け）を切（き）る")).toBe("髪の毛をきる");
    expect(stripReadings("駅（えき）に着（つ）きます")).toBe("えきにつきます");
  });
  it("drops a stray reading that does not follow kanji", () => {
    expect(stripReadings("たばこをやめる（たばこをやめる）")).toBe("たばこをやめる");
  });
  it("keeps brackets that are not readings", () => {
    expect(stripReadings("駅（東口）で会いましょう。")).toBe("駅（東口）で会いましょう。");
  });
});
