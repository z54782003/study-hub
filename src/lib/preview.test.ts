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
      grammar: ["① Nのために／V辞書形ために、〜", "② 〜んですか／〜んです", "③ 〜なければなりません"],
    });
  });
  it("copes with pages that have none of these", () => {
    expect(summarizePreview([{ type: "paragraph", boldStart: false, text: "hi" }])).toEqual({ lesson: null, exam: null, grammar: [] });
  });
});
