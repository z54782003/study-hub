// できる日本語 初中級 課文音檔：檔名 001–234 依課本順序排（每課：聞いてみよう全文 → ST1 チャレンジ各場面
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
  { n: 8, title: "ありがとう", st: ["うれしい出来事", "お世話になりました"], scenes: [nums(3), nums(4)], tasks: [3, 4] },
  { n: 9, title: "アルバイト先で", st: ["アルバイト先のルール", "楽しいアルバイト"], scenes: [["1", "2", "3-1", "3-2", "4"], nums(6)], tasks: [1, 3] },
  { n: 10, title: "旅行に行って", st: ["ハプニング！", "ガイドブックを片手に"], scenes: [["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"], nums(6)], tasks: [5, 2] },
  { n: 11, title: "地域社会の中で", st: ["慣れてくると", "スポーツチームに入って"], scenes: [nums(3), nums(4)], tasks: [2, 2] },
  { n: 12, title: "私の健康法", st: ["体調不良", "毎日、元気に！"], scenes: [nums(6), nums(5)], tasks: [2, 2] },
  { n: 13, title: "親の気持ち・子の気持ち", st: ["町で見かけた子どもたち", "思い出すと"], scenes: [nums(3), nums(3)], tasks: [3, 3] },
  { n: 14, title: "イベント・行事", st: ["私の国・町の行事", "贈り物の習慣"], scenes: [["1", "2", "3", "4-1", "4-2"], nums(4)], tasks: [2, 2] },
  { n: 15, title: "気になるニュース", st: ["発表の準備", "みんなの前で発表"], scenes: [nums(4), nums(3)], tasks: [2, 2] },
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

/** 每一課的音檔編號（001–234，依官方スクリプト的編號） */
export function lessonTracks(n: number): Track[] {
  let start = 1;
  for (const p of LESSON_PLANS) {
    const tracks = planTracks(p, start);
    if (p.n === n) return tracks;
    start += tracks.length;
  }
  return [];
}

export const lessonTitle = (n: number) => LESSON_PLANS.find((p) => p.n === n)?.title ?? "";

/**
 * 光碟版音檔（7012019_DiscA_01.mp3…）：A 片＝第 1–5 課、B 片＝第 6–10 課（第 11–15 課沒有）。
 * 一軌有時包含好幾個舊編號（やってみよう 整組一軌）。對照是用每軌長度和官方スクリプト的編號比對出來的。
 */
const DISC_LAYOUT =
  "A01:1 A02:2 A03:3 A04:4 A05:5 A06:6 A07:7 A08:8+9+10 A09:11 A10:12 A11:13 A12:14 A13:15 A14:16+17 A15:18 A16:19 A17:20 A18:21 A19:22 A20:23 A21:24 A22:25 A23:26+27+28 A24:29 A25:30+31 A26:32 A27:33 A28:34 A29:35 A30:36+37+38 A31:39 A32:40 A33:41 A34:42 A35:43 A36:44 A37:45 A38:46+47 A39:48 A40:49 A41:50 A42:51 A43:52+53 A44:54 A45:55 A46:56 A47:57 A48:58 A49:59 A50:60 A51:61+62 A52:63 A53:64 A54:65+66+67 A55:68 A56:69 A57:70 A58:71 A59:72 A60:73 A61:74+75+76 A62:77 A63:78 A64:79 A65:80+81+82 A66:83 " +
  "B01:84 B02:85 B03:86 B04:87 B05:88 B06:89 B07:90 B08:91 B09:92 B10:93 B11:94 B12:95 B13:96 B14:97 B15:98 B16:99 B17:100+101+102 B18:103 B19:104 B20:105 B21:106 B22:107 B23:108 B24:109 B25:110 B26:111 B27:112 B28:113 B29:114+115 B30:116 B31:117 B32:118 B33:119 B34:120 B35:121+122+123 B36:124 B37:125 B38:126 B39:127 B40:128 B41:129 B42:130 B43:131 B44:132 B45:133 B46:134 B47:135 B48:136 B49:137 B50:138+139+140 B51:141 B52:142 B53:143 B54:144 B55:145 B56:146 B57:147 B58:148 B59:149+150+151+152+153 B60:154 B61:155 B62:156 B63:157 B64:158 B65:159 B66:160+161 B67:162";

/** 光碟軌（"A08"）→ 包含的舊編號（[8, 9, 10]） */
export const DISC_TRACKS: Record<string, number[]> = Object.fromEntries(
  DISC_LAYOUT.split(" ").map((x) => {
    const [k, v] = x.split(":");
    return [k, v.split("+").map(Number)];
  }),
);

/** Notion 音檔網址 → 音檔代號：光碟版「7012019_DiscA_08.mp3」→「A08」；舊的「030_v3.mp3」→「030」 */
export function audioKey(url: string): string | null {
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  const disc = /_Disc([AB])_(\d+)\.mp3$/i.exec(name);
  if (disc) return `${disc[1].toUpperCase()}${disc[2].padStart(2, "0")}`;
  const no = trackNumber(url);
  return no ? String(no).padStart(3, "0") : null;
}

/** 音檔代號包含哪些舊編號 */
export const keyTracks = (key: string): number[] => DISC_TRACKS[key] ?? (/^\d{3}$/.test(key) ? [Number(key)] : []);

export type AudioRow = Track & { key: string | null; parts: Track[] };

/** 一課的播放列：同一個音檔的幾段合成一列（やってみよう 1〜3）；keys＝Notion 裡有的音檔代號 */
export function lessonRows(n: number, keys: Iterable<string>): AudioRow[] {
  const keyOf = new Map<number, string>();
  for (const k of keys) for (const no of keyTracks(k)) keyOf.set(no, k);
  const rows: AudioRow[] = [];
  for (const t of lessonTracks(n)) {
    const key = keyOf.get(t.no) ?? null;
    const last = rows.at(-1);
    if (key && last?.key === key) last.parts.push(t);
    else rows.push({ ...t, key, parts: [t] });
  }
  for (const r of rows) r.label = mergeLabels(r.parts.map((p) => p.label));
  return rows;
}

/** 「やってみよう 1」「やってみよう 3」→「やってみよう 1〜3」 */
function mergeLabels(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  const parts = labels.map((l) => /^(\S+) (.+)$/.exec(l));
  if (parts.every((m) => m && m[1] === parts[0]![1])) return `${parts[0]![1]} ${parts[0]![2]}〜${parts.at(-1)![2]}`;
  return labels.join("＋");
}

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
 *  「## 音檔スクリプト（チャレンジ・やってみよう…）」底下「### ST1 1」「### ST1 やってみよう 2」＋每段一句。 */
export function parseIndexPage(blocks: IndexBlock[]): TranscriptPart[] {
  const out: TranscriptBlock[] = [];
  let mode: "listen" | "read" | "challenge" | null = null;
  for (const b of blocks) {
    if (b.type === "heading_1" || b.type === "heading_2") {
      mode = b.text.includes("もう一度聞こう")
        ? "listen"
        : b.text.includes("話読聞書")
          ? "read"
          : b.text.includes("スクリプト") && /チャレンジ|やってみよう/.test(b.text)
            ? "challenge"
            : null;
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
