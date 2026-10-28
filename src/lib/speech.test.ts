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
  it("drops kana readings in brackets so the word is read once", () => {
    expect(stripReadings("明日は大事な面接（めんせつ）があるので、今日美容院で髪を切りました。")).toBe("明日は大事な面接があるので、今日美容院で髪を切りました。");
    expect(stripReadings("目標（もくひょう）を立（た）てる")).toBe("目標を立てる");
  });
  it("keeps brackets that are not readings", () => {
    expect(stripReadings("駅（東口）で会いましょう。")).toBe("駅（東口）で会いましょう。");
  });
});
