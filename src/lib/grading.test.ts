import { describe, expect, it } from "vitest";
import { acceptableAnswers, autoGrade, normalizeAnswer } from "./grading";

// 正確答案都取自 2026-10-26 日文題庫的實際資料
describe("autoGrade", () => {
  it("choice answers accept the number, the circled number, or the word", () => {
    const c = "② 悪い（顔色が悪い＝臉色不好）";
    for (const a of ["②", "2", "２", "悪い", "② 悪い"]) expect(autoGrade(a, c), a).toBe(true);
    expect(autoGrade("①", c)).toBe(false);
    expect(autoGrade("顔色が悪い＝臉色不好", c)).toBe(false); // 括號裡的說明不是答案
  });
  it("kanji with a reading accepts either", () => {
    expect(autoGrade("黄色", "黄色（きいろ）")).toBe(true);
    expect(autoGrade("きいろ", "黄色（きいろ）")).toBe(true);
    expect(autoGrade("ねなければなりません", "寝(ね)なければなりません")).toBe(true);
    expect(autoGrade("寝なければなりません", "寝(ね)なければなりません")).toBe(true);
  });
  it("a parenthesised alternative is accepted", () => {
    expect(autoGrade("さし", "さし（さす）")).toBe(true);
    expect(autoGrade("さす", "さし（さす）")).toBe(true);
    expect(autoGrade("来るんですか", "んですか（来るんですか）")).toBe(true);
    expect(autoGrade("んですか", "んですか（来るんですか）")).toBe(true);
  });
  it("ignores punctuation, spaces and width", () => {
    expect(autoGrade(" いつ日本へ来たんですか ", "いつ日本へ来たんですか。")).toBe(true);
    expect(autoGrade("申します。", "申します")).toBe(true);
  });
  it("does not treat a leading digit as an option number", () => {
    expect(autoGrade("3", "3時")).toBe(false);
    expect(autoGrade("3時", "3時")).toBe(true);
    expect(autoGrade("b", "b) 悪い")).toBe(true);
  });
  it("keeps katakana vs hiragana and particles strict", () => {
    expect(autoGrade("すーつ", "スーツ")).toBe(false);
    expect(autoGrade("で", "に")).toBe(false);
    expect(autoGrade("", "に")).toBe(false);
  });
  it("a different but valid translation is not auto-accepted (goes to AI)", () => {
    expect(autoGrade("来月入試があるので勉強しなければなりません", "来月入学試験を受けるので、勉強しなければならないんです。")).toBe(false);
  });
});

describe("helpers", () => {
  it("normalizes circled numbers and full-width", () => {
    expect(normalizeAnswer("② ＡＢ。")).toBe("2ab");
  });
  it("lists alternatives without duplicates", () => {
    expect(acceptableAnswers("に")).toEqual(["に"]);
  });
});
