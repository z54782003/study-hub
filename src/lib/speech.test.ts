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
});

describe("stripReadings", () => {
  it("reads marked kanji by their furigana, once", () => {
    expect(stripReadings("明日は大事な面接（めんせつ）があるので、今日美容院で髪を切りました。")).toBe("明日は大事なめんせつがあるので、今日美容院で髪を切りました。");
    expect(stripReadings("弟（おとうと）は小学校（しょうがっこう）に通（かよ）っています。")).toBe("おとうとはしょうがっこうにかよっています。");
  });
  it("drops a stray reading that does not follow kanji", () => {
    expect(stripReadings("たばこをやめる（たばこをやめる）")).toBe("たばこをやめる");
  });
  it("keeps brackets that are not readings", () => {
    expect(stripReadings("駅（東口）で会いましょう。")).toBe("駅（東口）で会いましょう。");
  });
});
