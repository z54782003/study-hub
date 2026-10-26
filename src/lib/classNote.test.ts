import { describe, expect, it } from "vitest";
import { labelItem, parseClassTitle, splitLesson, splitNumbered } from "./classNote";

const SUMMARY =
  "①連絡:11/13(金)12:30〜練馬で校外学習(大工体験)・授業なし ②漢字:体・色(色の語彙・顔色/調子のコロケーション)・黄・赤 ③宿題確認 文法ノート1〜7 ⑩テスト予告:10/27(火)意向形テスト(推定・録音で明言なし→❓)";

describe("splitNumbered", () => {
  it("splits circled numbers", () => {
    const { items, note } = splitNumbered(SUMMARY);
    expect(items).toHaveLength(4);
    expect(items[1]).toBe("漢字:体・色(色の語彙・顔色/調子のコロケーション)・黄・赤");
    expect(note).toBeNull();
  });
  it("pulls the ※ note out of homework", () => {
    const r = splitNumbered("①文法ノート 大8〜13番。②宿題はなるべくやってきた方がいい。※提出日・期限の指示は録音に無し。");
    expect(r.items).toEqual(["文法ノート 大8〜13番。", "宿題はなるべくやってきた方がいい。"]);
    expect(r.note).toBe("※提出日・期限の指示は録音に無し。");
  });
  it("falls back to lines", () => expect(splitNumbered("a\n\nb").items).toEqual(["a", "b"]));
});

describe("labelItem", () => {
  it("reads label and kind", () => {
    expect(labelItem("連絡:校外学習")).toEqual({ label: "連絡", body: "校外学習", kind: "notice" });
    expect(labelItem("テスト予告:10/27 意向形").kind).toBe("exam");
    expect(labelItem("宿題:文法ノート8〜13").kind).toBe("homework");
    expect(labelItem("宿題確認 文法ノート1〜7")).toEqual({ label: null, body: "宿題確認 文法ノート1〜7", kind: "homework" });
  });
  it("does not treat a time inside parentheses as a label", () =>
    expect(labelItem("p.51聞いてみよう(ワンさん: 10分)").label).toBeNull());
});

describe("parseClassTitle", () => {
  it("splits lesson, topic, points and pages", () => {
    expect(
      parseClassTitle("10/26（月）できる L3｜ST2 夢に向かって・〜ために・〜なければなりません・漢字（体・色・黄・赤）／本冊p.48–51"),
    ).toEqual({
      lesson: "できる L3",
      topic: "ST2 夢に向かって",
      points: ["〜ために", "〜なければなりません", "漢字（体・色・黄・赤）"],
      pages: "本冊p.48–51",
    });
  });
  it("keeps a ／ that is not a page range", () =>
    expect(parseClassTitle("できる L3｜〜んです／〜んですが").points).toEqual([]));
});

describe("splitLesson", () => {
  it("cuts at the first comma", () =>
    expect(splitLesson("できる日本語 初中級 第3課「私の目標」，接續 10/23 已教完的 ST3-1")).toEqual({
      main: "できる日本語 初中級 第3課「私の目標」",
      detail: "接續 10/23 已教完的 ST3-1",
    }));
});
