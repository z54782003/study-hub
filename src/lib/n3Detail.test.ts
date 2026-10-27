import { describe, expect, it } from "vitest";
import { DETAIL_HEADING, detailLines, parseDetail, type N3Detail } from "./n3Detail";

const sample: N3Detail = {
  usage: "表示經過一段時間得到的知識或技能。",
  forms: [],
  collocations: [
    { ja: "経験を積む", zh: "累積經驗" },
    { ja: "経験がある", zh: "有經驗" },
  ],
  examples: [{ ja: "海外で働いた経験があります。", kana: "かいがいではたらいたけいけんがあります。", zh: "我有在海外工作的經驗。" }],
  compare: "体験：親身體驗一次的事。",
};

describe("n3 detail", () => {
  it("round-trips through Notion paragraphs", () => {
    const blocks = [
      { type: "paragraph", text: "舊的備註" },
      { type: "heading_3", text: DETAIL_HEADING },
      ...detailLines(sample).map((text) => ({ type: "paragraph", text })),
    ];
    expect(parseDetail(blocks)).toEqual(sample);
  });
  it("keeps grammar forms and stops at the next heading", () => {
    const d = parseDetail([
      { type: "heading_3", text: "📘 詳解（AI）" },
      { type: "paragraph", text: "接續：動詞た形＋ばかり" },
      { type: "paragraph", text: "接續：名詞＋の＋ばかり" },
      { type: "heading_2", text: "筆記" },
      { type: "paragraph", text: "用法：不算" },
    ]);
    expect(d?.forms).toEqual(["動詞た形＋ばかり", "名詞＋の＋ばかり"]);
    expect(d?.usage).toBe("");
  });
  it("returns null without the heading", () => {
    expect(parseDetail([{ type: "paragraph", text: "用法：…" }])).toBeNull();
  });
});
