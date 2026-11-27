import { describe, expect, it } from "vitest";
import { bookOf, isBook, lessonNo, parseAnswers, splitLine } from "./speaking";

describe("parseAnswers", () => {
  it("splits items on blank lines and reads the label", () => {
    const t = "①（自編）\nＡ：シフトの希望はいつまでに出したらいいですか。\nＢ：15日までに出すことになっています。\n\n②\nＡ：ごみはいつ出したらいいですか。\n";
    expect(parseAnswers(t)).toEqual([
      { label: "①", own: true, lines: ["Ａ：シフトの希望はいつまでに出したらいいですか。", "Ｂ：15日までに出すことになっています。"] },
      { label: "②", own: false, lines: ["Ａ：ごみはいつ出したらいいですか。"] },
    ]);
  });
  it("keeps text on the label line", () => {
    expect(parseAnswers("① Ａ：はい。")).toEqual([{ label: "①", own: false, lines: ["Ａ：はい。"] }]);
    expect(parseAnswers("")).toEqual([]);
  });
});

describe("splitLine", () => {
  it("separates speaker and marks alternatives", () => {
    expect(splitLine("Ｂ：お願いします。")).toEqual({ speaker: "Ｂ", text: "お願いします。", alt: false });
    expect(splitLine("（或）Ｂ：お願いします。")).toEqual({ speaker: "Ｂ", text: "お願いします。", alt: true });
    expect(splitLine("あっ！")).toEqual({ speaker: "", text: "あっ！", alt: false });
  });
  it("orders lessons by number", () => {
    expect(lessonNo("初中級 L12")).toBe(12);
    expect(lessonNo("初級 L3")).toBe(3);
  });
  it("tells the two books apart", () => {
    expect(bookOf("初級 L3")).toBe("初級");
    expect(bookOf("初中級 L3")).toBe("初中級");
    expect(bookOf("中級 L1")).toBe(null);
    expect(isBook("初級")).toBe(true);
    expect(isBook(undefined)).toBe(false);
  });
});
