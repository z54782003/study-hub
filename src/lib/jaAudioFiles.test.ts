import { describe, expect, it } from "vitest";
import { audioFileName, audioText, contentHash, currentAudio, genHash, parseAudioFileName, type AudioSource } from "./jaAudioFiles";

const src: AudioSource = { word: "速い", reading: "はやい", pitch: 2, ex1: "新幹線（しんかんせん）が速（はや）いです。", ex2: "" };
const nameFor = (kind: "w" | "e1" | "e2", s = src) => audioFileName(kind, contentHash(kind, audioText(kind, s)!), genHash({ speaker: "x" }));

describe("audio file names", () => {
  it("round-trips the name", () => {
    const n = nameFor("e1");
    expect(n).toMatch(/^e1-[0-9a-f]{8}-[0-9a-f]{6}\.mp3$/);
    expect(parseAudioFileName(n)).toMatchObject({ kind: "e1" });
    expect(parseAudioFileName("w-zz.mp3")).toBeNull();
  });
  it("has no text for empty examples and 〜 words", () => {
    expect(audioText("e2", src)).toBeNull();
    expect(audioText("e1", { ...src, ex1: "—" })).toBeNull();
    expect(audioText("e1", { ...src, ex1: " … " })).toBeNull();
    expect(audioText("w", { ...src, word: "〜日" })).toBeNull();
  });
  it("only uses files whose content still matches Notion", () => {
    const files = [
      { name: nameFor("w"), url: "https://n/w", expires: "2030-01-01T00:00:00Z" },
      { name: nameFor("e1"), url: "https://n/e1", expires: null },
      { name: "notes.pdf", url: "https://n/x", expires: null },
    ];
    expect(Object.keys(currentAudio("pid", src, files))).toEqual(["w", "e1"]);
    expect(currentAudio("pid", src, files).w).toEqual({ url: "https://n/w", expires: "2030-01-01T00:00:00Z", fallback: "/api/vocab-audio/pid/w" });
    // 改了聲調：單字的音檔不算數，例句的照用
    expect(Object.keys(currentAudio("pid", { ...src, pitch: 0 }, files))).toEqual(["e1"]);
    // 改了例句
    expect(Object.keys(currentAudio("pid", { ...src, ex1: "新しい例句です。" }, files))).toEqual(["w"]);
  });
});
