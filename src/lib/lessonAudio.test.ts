import { describe, expect, it } from "vitest";
import { lessonTracks, parseIndexPage, parseTranscript, trackNumber } from "./lessonAudio";

describe("lessonTracks", () => {
  it("numbers lesson 1 from 001: full, ST1 scenes, tasks, ST2, tasks, reading", () => {
    const t = lessonTracks(1);
    expect(t).toHaveLength(18);
    expect(t[0]).toEqual({ no: 1, kind: "full", label: "聞いてみよう（全文）" });
    expect(t[1]).toMatchObject({ no: 2, st: 1, label: "チャレンジ 1" });
    expect(t[7]).toMatchObject({ no: 8, kind: "task", st: 1 });
    expect(t[11]).toMatchObject({ no: 12, st: 2, label: "チャレンジ 1-1" });
    expect(t[17]).toMatchObject({ no: 18, kind: "read" });
  });

  it("continues numbering across lessons (long full dialogues land on the right files)", () => {
    expect(lessonTracks(2)[0].no).toBe(19);
    expect(lessonTracks(3)[0].no).toBe(40);
    expect(lessonTracks(4)[0].no).toBe(55);
    expect(lessonTracks(5)[0].no).toBe(69);
    expect(lessonTracks(6)[0].no).toBe(84);
    expect(lessonTracks(7)[0].no).toBe(95);
    expect(lessonTracks(8)[0].no).toBe(109);
    expect(lessonTracks(8).at(-1)).toMatchObject({ no: 123, kind: "read" });
    expect(lessonTracks(9)).toEqual([{ no: 124, kind: "full", label: "聞いてみよう（全文）" }]);
    expect(lessonTracks(10)).toEqual([]);
  });
});

describe("trackNumber", () => {
  it("reads the number from the file name in a signed URL", () => {
    expect(trackNumber("https://s3.example.com/a/b/030_v3.mp3?X-Amz=1")).toBe(30);
    expect(trackNumber("https://s3.example.com/a/b/124_v2.mp3")).toBe(124);
    expect(trackNumber("https://s3.example.com/a/b/book.pdf")).toBeNull();
  });
});

describe("parseIndexPage", () => {
  it("reads the full dialogue, the short text and the scene scripts from a 課本索引 page", () => {
    const parts = parseIndexPage([
      { type: "heading_2", text: "1-1｜場面（p.16）" },
      { type: "paragraph", text: "練習：Ａ：これは出さない。", bold: "練習" },
      { type: "heading_2", text: "できる！＋話読聞書（p.26）" },
      { type: "paragraph", text: "任務：ほかの段落。" },
      { type: "paragraph", text: "短文「自己紹介」（可背誦範本）：短文です。", bold: "短文「自己紹介」（可背誦範本）" },
      { type: "heading_2", text: "もう一度聞こう（p.28，CD A01）" },
      { type: "paragraph", text: "電話で：Ａ：もしもし。／…／Ｂ：はい。", bold: "電話で" },
      { type: "heading_2", text: "📘 文法ノート" },
      { type: "paragraph", text: "自習用。" },
      { type: "heading_2", text: "チャレンジ スクリプト" },
      { type: "heading_3", text: "ST1 1" },
      { type: "paragraph", text: "Ａ：こんにちは。" },
    ]);
    expect(parts).toEqual([
      { heading: "話読聞書", scenes: [{ title: "自己紹介", lines: [{ speaker: null, text: "短文です。" }] }] },
      {
        heading: "聞いてみよう",
        scenes: [
          {
            title: "電話で",
            lines: [
              { speaker: "Ａ", text: "もしもし。" },
              { speaker: null, text: "⋮" },
              { speaker: "Ｂ", text: "はい。" },
            ],
          },
        ],
      },
      { heading: "チャレンジ", scenes: [{ title: "ST1 1", lines: [{ speaker: "Ａ", text: "こんにちは。" }] }] },
    ]);
  });
});

describe("parseTranscript", () => {
  it("splits sections, scenes and speaker lines", () => {
    const parts = parseTranscript([
      { type: "heading_2", text: "聞いてみよう" },
      { type: "heading_3", text: "場面" },
      { type: "paragraph", text: "Ａ：もしもし。" },
      { type: "paragraph", text: "⋮" },
      { type: "heading_2", text: "話読聞書" },
      { type: "paragraph", text: "短文。" },
    ]);
    expect(parts).toEqual([
      {
        heading: "聞いてみよう",
        scenes: [{ title: "場面", lines: [{ speaker: "Ａ", text: "もしもし。" }, { speaker: null, text: "⋮" }] }],
      },
      { heading: "話読聞書", scenes: [{ title: null, lines: [{ speaker: null, text: "短文。" }] }] },
    ]);
  });
});
