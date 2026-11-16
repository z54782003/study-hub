import { describe, expect, it } from "vitest";
import { findChildPages, type TreeBlock } from "./childPages";

const page = (id: string, title: string): TreeBlock => ({ id, type: "child_page", has_children: true, child_page: { title } });
const box = (id: string, type: string, extra: Partial<TreeBlock> = {}): TreeBlock => ({ id, type, has_children: true, ...extra });

describe("findChildPages", () => {
  const tree: Record<string, TreeBlock[]> = {
    // 初中級課程頁：索引頁在 toggle 裡，也有直接放的頁
    mid: [page("audio", "課文音檔"), box("t1", "toggle"), { id: "p", type: "paragraph" }],
    t1: [page("m1", "初中級課本索引｜L1 新しい一歩"), page("m2", "初中級課本索引｜L2 楽しいショッピング")],
    // 初級課程頁：分欄 → 欄 → toggle → 子頁（3 層容器）
    beg: [box("cl", "column_list")],
    cl: [box("c1", "column")],
    c1: [box("t2", "toggle")],
    t2: [page("b1", "課本索引｜L1 はじめまして"), box("t3", "toggle")],
    t3: [page("deep", "太深了")],
    // 舊計畫頁：已經搬走，只剩重複的那頁和可收合標題
    plan: [page("m1", "初中級課本索引｜L1 新しい一歩"), box("h", "heading_2", { heading_2: { is_toggleable: true } }), box("h2", "heading_2", { heading_2: {} })],
    h: [page("old", "舊頁")],
    h2: [page("never", "不是 toggle 的標題不該被打開")],
    m1: [page("inner", "子頁裡的子頁不找")],
  };
  const calls: string[] = [];
  const list = async (id: string) => {
    calls.push(id);
    return tree[id] ?? [];
  };

  it("walks every parent in order, into toggles and columns, up to 3 levels", async () => {
    const pages = await findChildPages(["mid", "beg", "plan"], list);
    expect(pages.map((p) => p.id)).toEqual(["audio", "m1", "m2", "b1", "old"]);
    expect(pages[1]).toEqual({ id: "m1", title: "初中級課本索引｜L1 新しい一歩" });
    expect(calls).not.toContain("t3"); // 第 4 層不打開
    expect(calls).not.toContain("m1"); // 子頁不往下找
    expect(calls).not.toContain("h2");
  });

  it("returns nothing for empty parents", async () => {
    expect(await findChildPages(["missing"], list)).toEqual([]);
  });

  it("skips a parent it cannot read and keeps going", async () => {
    const failing = async (id: string) => {
      if (id === "mid") throw new Error("Could not find block");
      return list(id);
    };
    const errors: string[] = [];
    const pages = await findChildPages(["mid", "beg"], failing, { onError: (p) => errors.push(p) });
    expect(pages.map((p) => p.id)).toEqual(["b1"]);
    expect(errors).toEqual(["mid"]);
    await expect(findChildPages(["mid"], failing)).rejects.toThrow("Could not find block");
  });
});
