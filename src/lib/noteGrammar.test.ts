import { describe, expect, it } from "vitest";
import { parseNoteGrammar, type NoteBlock } from "./noteGrammar";

const p = (type: string, ...parts: (string | [string])[]): NoteBlock => ({
  type,
  segs: parts.map((x) => (typeof x === "string" ? { text: x, bold: false } : { text: x[0], bold: true })),
});

describe("class note grammar", () => {
  it("collects numbered points and their bullets under the 文法 heading only", () => {
    const blocks = [
      p("heading_2", "授業の流れ"),
      p("paragraph", ["① 不是文法"]),
      p("heading_2", "文法（全部）"),
      p("paragraph", ["① 〜ために、〜（目的）"]),
      p("bulleted_list_item", "句型：V辞書形＋ために"),
      p("bulleted_list_item", "說明：", ["目的「為了〜」"], "。"),
      p("bulleted_list_item", "⚠️易錯：", ["×上手するために"]),
      p("paragraph", ["② 〜んですか（確認）"]),
      p("bulleted_list_item", "例：誰が作ったんですか？／山田さんが書いたんですか？"),
      p("heading_2", "單字・表現（全部）"),
      p("paragraph", ["③ 不算"]),
    ];
    const g = parseNoteGrammar(blocks);
    expect(g.map((x) => [x.no, x.title])).toEqual([
      ["①", "〜ために、〜（目的）"],
      ["②", "〜んですか（確認）"],
    ]);
    expect(g[0].bullets[0]).toEqual({ label: "句型", segs: [{ text: "V辞書形＋ために", bold: false }] });
    expect(g[0].bullets[1].segs).toEqual([
      { text: "目的「為了〜」", bold: true },
      { text: "。", bold: false },
    ]);
    expect(g[0].bullets[2].label).toBe("⚠️易錯");
    expect(g[1].bullets[0].label).toBe("例");
  });
  it("leaves bullets without a short label alone", () => {
    const g = parseNoteGrammar([p("heading_2", "文法"), p("paragraph", "③ 〜ので"), p("bulleted_list_item", "そのまま使える、赤・青：ルール")]);
    expect(g[0].bullets[0].label).toBeNull();
  });
});
