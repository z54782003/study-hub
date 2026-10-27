import { describe, expect, it } from "vitest";
import { baseForms } from "./WordSheet";

describe("baseForms", () => {
  it("tries likely base forms after the word itself", () => {
    expect(baseForms("gliders")).toEqual(["gliders", "glider"]);
    expect(baseForms("tried")).toEqual(["tried", "try", "tri", "trie"]);
    expect(baseForms("making")).toEqual(["making", "mak", "make"]);
    expect(baseForms("stopped")).toEqual(["stopped", "stopp", "stoppe", "stop"]);
    expect(baseForms("flight")).toEqual(["flight"]);
  });
});
