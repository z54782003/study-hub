// できる日本語 初中級 課文音檔：檔名 001–124 依課本順序排（每課：聞いてみよう全文 → ST1 チャレンジ各場面
// → ST1 やってみよう → ST2 チャレンジ → ST2 やってみよう → 話読聞書）。音檔和課文都存在 Notion，這裡只有編號規則。

export type TrackKind = "full" | "scene" | "task" | "read";
export type Track = { no: number; kind: TrackKind; label: string; st?: 1 | 2 };
export type LessonPlan = { n: number; title: string; st: [string, string]; scenes: [string[], string[]]; tasks: [number, number] };

const nums = (k: number) => Array.from({ length: k }, (_, i) => String(i + 1));

export const LESSON_PLANS: LessonPlan[] = [
  { n: 1, title: "新しい一歩", st: ["アルバイトを探す", "新しい友達"], scenes: [nums(6), ["1-1", "1-2", "2", "3"]], tasks: [4, 2] },
  { n: 2, title: "楽しいショッピング", st: ["上手に買い物", "一緒に食事"], scenes: [nums(6), nums(7)], tasks: [3, 3] },
  { n: 3, title: "私の目標", st: ["これからの計画", "夢に向かって"], scenes: [nums(5), ["1", "2-1", "2-2", "3"]], tasks: [2, 2] },
  { n: 4, title: "住んでいる町で", st: ["生活を楽しむ", "行き方を教える"], scenes: [nums(5), nums(2)], tasks: [2, 3] },
  { n: 5, title: "大変な1日", st: ["困ったな……", "駅で"], scenes: [["1", "2", "3-1", "3-2"], nums(3)], tasks: [3, 3] },
  { n: 6, title: "旅行に行こう", st: ["旅行の計画", "旅行の準備"], scenes: [nums(4), nums(3)], tasks: [1, 1] },
  { n: 7, title: "西川さんの家へ", st: ["初めての訪問", "一緒に作りましょう"], scenes: [nums(4), ["1", "2", "3-1", "3-2"]], tasks: [3, 1] },
  { n: 8, title: "ありがとう", st: ["うれしい出来事", "お世話になりました"], scenes: [nums(3), nums(4)], tasks: [2, 4] },
];

/** 這一課在課本順序裡的所有音檔 */
function planTracks(p: LessonPlan, start: number): Track[] {
  const out: Track[] = [];
  let no = start;
  const add = (t: Omit<Track, "no">) => out.push({ no: no++, ...t });
  add({ kind: "full", label: "聞いてみよう（全文）" });
  for (const st of [1, 2] as const) {
    for (const s of p.scenes[st - 1]) add({ kind: "scene", st, label: `チャレンジ ${s}` });
    const k = p.tasks[st - 1];
    for (let i = 1; i <= k; i++) add({ kind: "task", st, label: k > 1 ? `やってみよう ${i}` : "やってみよう" });
  }
  add({ kind: "read", label: "話読聞書" });
  return out;
}

/** 每一課的音檔編號（第 9 課之後只有開頭，看手上有哪些檔案） */
export function lessonTracks(n: number): Track[] {
  let start = 1;
  for (const p of LESSON_PLANS) {
    const tracks = planTracks(p, start);
    if (p.n === n) return tracks;
    start += tracks.length;
  }
  // 規劃以外的課：從上一課結束後的編號開始，第一個當全文
  return n === LESSON_PLANS.length + 1 ? [{ no: start, kind: "full", label: "聞いてみよう（全文）" }] : [];
}

export const lessonTitle = (n: number) => LESSON_PLANS.find((p) => p.n === n)?.title ?? "";

/** Notion 音檔的檔名（網址最後一段）→ 編號：「030_v3.mp3」→ 30 */
export function trackNumber(url: string): number | null {
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  const m = /^(\d{3})_v\d+\.mp3$/i.exec(name);
  return m ? Number(m[1]) : null;
}

export type TranscriptLine = { speaker: string | null; text: string };
export type TranscriptPart = { heading: string; scenes: { title: string | null; lines: TranscriptLine[] }[] };
export type TranscriptBlock = { type: string; text: string };

export type IndexBlock = TranscriptBlock & { bold?: string };

/** 「初中級課本索引｜L〇」頁 → 課文：
 *  「## もう一度聞こう」每段「**場面**：人：台詞／人：台詞…」、
 *  「## できる！＋話読聞書」的「**短文「題目」…**：本文」、
 *  「## チャレンジ スクリプト」底下「### ST1 1」＋每段一句。 */
export function parseIndexPage(blocks: IndexBlock[]): TranscriptPart[] {
  const out: TranscriptBlock[] = [];
  let mode: "listen" | "read" | "challenge" | null = null;
  for (const b of blocks) {
    if (b.type === "heading_1" || b.type === "heading_2") {
      mode = b.text.includes("もう一度聞こう") ? "listen" : b.text.includes("話読聞書") ? "read" : b.text.includes("チャレンジ") ? "challenge" : null;
      if (mode) out.push({ type: "heading_2", text: { listen: "聞いてみよう", read: "話読聞書", challenge: "チャレンジ" }[mode] });
      continue;
    }
    if (!mode || (b.type !== "paragraph" && b.type !== "heading_3")) continue;
    if (mode === "challenge") {
      out.push(b);
      continue;
    }
    const bold = b.bold?.trim() ?? "";
    const body = (bold && b.text.startsWith(bold) ? b.text.slice(bold.length) : b.text).replace(/^[：:]\s*/, "");
    if (mode === "listen") {
      if (bold) out.push({ type: "heading_3", text: bold.replace(/[：:]$/, "") });
      for (const line of body.split("／")) out.push({ type: "paragraph", text: line.trim() === "…" ? "⋮" : line });
    } else if (bold.startsWith("短文")) {
      const title = /「(.+?)」/.exec(bold)?.[1];
      if (title) out.push({ type: "heading_3", text: title });
      out.push({ type: "paragraph", text: body });
    }
  }
  return parseTranscript(out);
}

/** 課文頁：## 段落（聞いてみよう／話読聞書）、### 場面、每段「人名：台詞」 */
export function parseTranscript(blocks: TranscriptBlock[]): TranscriptPart[] {
  const parts: TranscriptPart[] = [];
  for (const b of blocks) {
    const text = b.text.trim();
    if (!text) continue;
    if (b.type === "heading_1" || b.type === "heading_2") {
      parts.push({ heading: text, scenes: [] });
      continue;
    }
    const part = parts.at(-1) ?? (parts.push({ heading: "", scenes: [] }), parts[0]);
    if (b.type === "heading_3") {
      part.scenes.push({ title: text, lines: [] });
      continue;
    }
    const scene = part.scenes.at(-1) ?? (part.scenes.push({ title: null, lines: [] }), part.scenes[0]);
    const m = /^([^：:]{1,16})[：:](.+)$/s.exec(text);
    scene.lines.push(m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: null, text });
  }
  return parts;
}
