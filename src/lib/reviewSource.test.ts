import { describe, expect, it } from "vitest";
import { examChapters, examLessons, parseLessons, parseSource, sourceQuery } from "./reviewSource";
import type { ReviewSource } from "./types";

describe("parseLessons", () => {
  it("accepts lists and ranges", () => expect(parseLessons("3,1-2,99")).toEqual([1, 2, 3]));
  it("ignores junk", () => expect(parseLessons("a,,")).toEqual([]));
});

describe("parseSource / sourceQuery", () => {
  it("round-trips a bank filter", () => {
    const s: ReviewSource = { src: "bank", level: "初中級", lessons: [1, 3], qtype: "C 翻譯", scope: "all", count: 10 };
    expect(parseSource(new URLSearchParams(sourceQuery(s)))).toEqual(s);
  });
  it("keeps the old mode=mistakes link working", () => expect(parseSource(new URLSearchParams("mode=mistakes"))).toEqual({ src: "mistakes" }));
  it("defaults to due and rejects unknown values", () => {
    expect(parseSource(new URLSearchParams(""))).toEqual({ src: "due" });
    expect(parseSource(new URLSearchParams("src=bank&level=x&qtype=y&count=999"))).toMatchObject({ level: null, qtype: null, count: 50 });
  });
});

describe("examLessons", () => {
  it("reads lesson ranges from exam scopes", () => {
    expect(examLessons("1〜3課 語彙・文法")).toEqual([1, 2, 3]);
    expect(examLessons("6〜10課 読解")).toEqual([6, 7, 8, 9, 10]);
    expect(examLessons("ビジネス 2・7課")).toEqual([]);
    expect(examLessons("「私の失敗」（5課）")).toEqual([]);
    expect(examLessons("HSJⅡ 1・2章")).toEqual([]);
  });
});

describe("examChapters", () => {
  it("maps kanji test scopes to chapters", () => {
    expect(examChapters("HSJⅡ 1・2章")).toEqual(["HSJⅡ 1章", "HSJⅡ 2章"]);
    expect(examChapters("口頭表現／HSJⅡ 7・8章".split("／")[1])).toEqual(["HSJⅡ 7章", "HSJⅡ 8章"]);
    expect(examChapters("1〜3課 語彙・文法")).toEqual([]);
  });
});
