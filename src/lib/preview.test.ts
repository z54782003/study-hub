import { describe, expect, it } from "vitest";
import { pickPreviewPage, summarizePreview } from "./preview";

const page = (title: string, createdTime: string) => ({ id: title, title, createdTime });

describe("pickPreviewPage", () => {
  it("matches the date at the start of the title, ignoring a leading emoji", () => {
    const pages = [page("10/2（金）預習｜L1", "2026-10-01T23:30:00Z"), page("🌅 10/26（月）預習｜L3", "2026-10-25T23:37:00Z")];
    expect(pickPreviewPage(pages, "2026-10-26", "Asia/Tokyo")?.title).toBe("🌅 10/26（月）預習｜L3");
    expect(pickPreviewPage(pages, "2026-10-02", "Asia/Tokyo")?.title).toBe("10/2（金）預習｜L1");
  });
  it("falls back to the page created today in Tokyo when the title date is off by one", () => {
    // 實際案例：東京 10/26 08:37 建立，標題卻是 10/25
    const pages = [page("10/23（金）預習｜L3", "2026-10-22T23:30:00Z"), page("10/25（日）預習｜L3", "2026-10-25T23:37:01Z")];
    expect(pickPreviewPage(pages, "2026-10-26", "Asia/Tokyo")?.title).toBe("10/25（日）預習｜L3");
  });
  it("returns null when nothing fits", () => {
    expect(pickPreviewPage([page("10/23（金）預習｜L3", "2026-10-22T23:30:00Z")], "2026-10-26", "Asia/Tokyo")).toBeNull();
  });
});


describe("summarizePreview", () => {
  // 2026-10-26 預習頁（10/26（月）預習｜L3）的實際結構
  const blocks = [
    {
      type: "callout",
      boldStart: true,
      text:
        "今日課次：できる日本語 初中級 第3課「私の目標」，今天預期進入 ST3-2「夢に向かって」（本冊 p.48–51）。\n" +
        "Can-do（3-2）：自分の将来のことで興味があることについて…\n" +
        "考試預告：10/27（二）動詞の形テスト：意向形。11/4（三）アチーブテスト（1〜3課語彙・文法）。\n" +
        "⚠️ 下一節課為 10/26（一）…",
    },
    { type: "heading_2", boldStart: false, text: "句型（ST3-2 言ってみよう原句，本冊 p.50–51）" },
    { type: "paragraph", boldStart: true, text: "① A：Bさんの将来の夢は何ですか。" },
    { type: "heading_2", boldStart: false, text: "文法點解說（ポイント27–29）" },
    { type: "paragraph", boldStart: true, text: "① Nのために／V辞書形ために、〜（表示「為了〜這個目的」）" },
    { type: "bulleted_list_item", boldStart: false, text: "句型：名詞＋の＋ために" },
    { type: "paragraph", boldStart: true, text: "② 〜んですか／〜んです（說明背景、追問原因）" },
    { type: "paragraph", boldStart: true, text: "③ 〜なければなりません（義務、不得不做）" },
    { type: "heading_2", boldStart: false, text: "單字（ST3-2 ことば表）" },
    { type: "paragraph", boldStart: true, text: "補充：笑顔" },
  ];
  it("extracts lesson, exam notice and grammar points", () => {
    expect(summarizePreview(blocks)).toEqual({
      lesson: "できる日本語 初中級 第3課「私の目標」，今天預期進入 ST3-2「夢に向かって」（本冊 p.48–51）。",
      exam: "10/27（二）動詞の形テスト：意向形。11/4（三）アチーブテスト（1〜3課語彙・文法）。",
      grammarTitle: "文法點解說（ポイント27–29）",
      grammar: ["① Nのために／V辞書形ために、〜", "② 〜んですか／〜んです", "③ 〜なければなりません"],
      grammarNote: null,
    });
  });
  it("copes with pages that have none of these", () => {
    expect(summarizePreview([{ type: "paragraph", boldStart: false, text: "hi" }])).toEqual({
      lesson: null,
      exam: null,
      grammarTitle: null,
      grammar: [],
      grammarNote: null,
    });
  });
  // 2026-10-27 預習頁：第一個 callout 是修正說明；考試寫成「⚠️ 今日考試」；文法是複習表格＋易混淆總整理
  it("reads the review-day layout", () => {
    const r = summarizePreview([
      { type: "callout", boldStart: false, text: "（修正說明：這頁原本因排程時區換算誤差被標成「10/26」…）" },
      {
        type: "callout",
        boldStart: true,
        text:
          "今日課次：できる日本語 初中級 第3課「私の目標」——今天是 L3 最終日（星合先生）。\n" +
          "Can-do（課）：自分の目標や計画を話したり…\n" +
          "⚠️ 今日考試：動詞の形テスト（意向形）——グループ1・2・3的意向形變化規則。\n" +
          "⚠️ 漏教內容確認：…",
      },
      { type: "heading_2", boldStart: false, text: "今天的任務／教材（推估，可能是總複習）" },
      { type: "paragraph", boldStart: true, text: "できる！＋話読聞書（p.52，CD A44）：任務是…" },
      { type: "heading_2", boldStart: false, text: "L3 全課文法快速複習（今天沒有新文法，考試前掃一遍）" },
      {
        type: "table",
        boldStart: false,
        text: "",
        rows: [
          ["文法點", "句型", "中文", "易混淆提醒"],
          ["① 〜たら、〜", "V普通形た＋ら", "如果・…的話就", "…"],
          ["⑧ Vナイ形—なければなりません", "V否定形（去ない）＋なければなりません", "不得不、必須", "…"],
        ],
      },
      { type: "paragraph", boldStart: true, text: "⚠️易混淆總整理：②③都是「打算做」，但②較婉轉…" },
      { type: "heading_2", boldStart: false, text: "單字（今日/課末補充，共4語）" },
    ]);
    expect(r).toEqual({
      lesson: "できる日本語 初中級 第3課「私の目標」——今天是 L3 最終日（星合先生）。",
      exam: "動詞の形テスト（意向形）——グループ1・2・3的意向形變化規則。",
      grammarTitle: "L3 全課文法快速複習（今天沒有新文法，考試前掃一遍）",
      grammar: ["① 〜たら、〜\t如果・…的話就", "⑧ Vナイ形—なければなりません\t不得不、必須"],
      grammarNote: "易混淆總整理：②③都是「打算做」，但②較婉轉…",
    });
  });
});
