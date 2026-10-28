import { describe, expect, it } from "vitest";
import { parseNoteGrammar, type NoteBlock, type Seg } from "./noteGrammar";

const segs = (...parts: (string | [string])[]): Seg[] => parts.map((x) => (typeof x === "string" ? { text: x, bold: false } : { text: x[0], bold: true }));
const p = (type: string, ...parts: (string | [string])[]): NoteBlock => ({ type, segs: segs(...parts) });
const table = (header: boolean, ...rows: string[][]): NoteBlock => ({ type: "table", segs: [], header, rows: rows.map((r) => r.map((c) => segs(c))) });
const text = (l: Seg[]) => l.map((s) => s.text).join("");

describe("class note grammar", () => {
  it("keeps 句型・說明・例・易錯 under the 文法 heading and drops the rest", () => {
    const g = parseNoteGrammar([
      p("heading_2", "上課流程"),
      p("paragraph", ["① 不是文法"]),
      p("heading_2", "文法（全部）"),
      p("paragraph", ["① 〜ために、〜（目的）"]),
      p("bulleted_list_item", "句型：V辞書形＋ために"),
      p("bulleted_list_item", "說明：", ["目的「為了〜」"], "。"),
      p("bulleted_list_item", "例：ケーキを作るために卵を買います。／健康のために歩きます。／三つ目。"),
      p("bulleted_list_item", "⚠️易錯：", ["×上手するために"]),
      p("bulleted_list_item", "🎙️逐字（日）：「ためにです」"),
      p("bulleted_list_item", "📘出處：本冊 p.48"),
      p("heading_2", "單字・表現（全部）"),
      p("paragraph", ["② 不算"]),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].title).toBe("〜ために、〜（目的）");
    expect(g[0].pattern.map(text)).toEqual(["V辞書形＋ために"]);
    expect(g[0].explain).toEqual([segs(["目的「為了〜」"], "。")]);
    expect(g[0].examples.map((e) => text(e.ja))).toEqual(["ケーキを作るために卵を買います。", "健康のために歩きます。"]);
    expect(g[0].mistakes).toEqual([segs(["×上手するために"])]);
  });

  it("reads nested bullets and examples from the table after 「例：」", () => {
    const g = parseNoteGrammar([
      p("heading_2", "文法"),
      p("paragraph", "① 〜んですが"),
      { ...p("bulleted_list_item", "說明："), children: [p("bulleted_list_item", "開場白"), p("bulleted_list_item", "だ→な")] },
      p("bulleted_list_item", "例："),
      table(true, ["例句", "出處"], ["歯が痛いんですが、〜。", "老師"], ["ちょっと聞きたいんですが。", "老師"], ["三つ目。", "—"]),
      { ...p("bulleted_list_item", "⚠️易錯："), children: [p("bulleted_list_item", "①後面才是重點")] },
      p("paragraph", "② 〜なら"),
      p("bulleted_list_item", "例："),
      table(true, ["問", "推薦（〜なら）", "理由", "出處"], ["スキーがしたいんですが。", "スキーなら北海道がいいですよ。", "雪がいい。", "老師"], ["—", "温泉なら別府がいいですよ。", "—", "老師"]),
      p("paragraph", "③ 〜までに"),
      p("bulleted_list_item", "例："),
      table(true, ["例句", "說明"], ["金曜日までに出してください。", "最晚星期五"]),
    ]);
    expect(g[0].explain.map(text)).toEqual(["開場白", "だ→な"]);
    expect(g[0].examples.map((e) => text(e.ja))).toEqual(["歯が痛いんですが、〜。", "ちょっと聞きたいんですが。"]);
    expect(g[0].mistakes.map(text)).toEqual(["①後面才是重點"]);
    expect(g[1].examples.map((e) => text(e.ja))).toEqual(["スキーがしたいんですが。 → スキーなら北海道がいいですよ。", "温泉なら別府がいいですよ。"]);
    // 問答都有的列優先
    const q = parseNoteGrammar([p("heading_2", "文法"), p("paragraph", "① x"), p("bulleted_list_item", "例："), table(true, ["問", "答"], ["—", "只有答。"], ["問。", "答。"])]);
    expect(q[0].examples.map((e) => text(e.ja))).toEqual(["問。 → 答。", "只有答。"]);
    expect(g[2].examples).toEqual([{ ja: segs("金曜日までに出してください。"), note: "最晚星期五" }]);
  });
});
