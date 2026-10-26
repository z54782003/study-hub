import { describe, expect, it } from "vitest";
import { speakableJa } from "./speech";

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
