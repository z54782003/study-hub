// 課堂筆記頁「## 文法（全部）」：「**① 〜ために、〜（目的）**」一段＋底下條列「句型：…」「說明：…」「例：…」「⚠️易錯：…」
// 只留句型・說明・兩個例句・易錯；逐字稿、出處等不顯示。例句可以寫在條列裡（「／」分句）或緊接著的表格。

export type Seg = { text: string; bold: boolean };
/** 表格：rows 是每列每格的文字；header＝第一列是標題列 */
export type NoteBlock = { type: string; segs: Seg[]; children?: NoteBlock[]; rows?: Seg[][][]; header?: boolean };
export type Example = { ja: Seg[]; note: string };
export type GrammarPoint = { no: string; title: string; pattern: Seg[][]; explain: Seg[][]; examples: Example[]; mistakes: Seg[][] };

const EXAMPLES = 2;
const CIRCLED = /^\s*([①-⑳])\s*/;
const plain = (segs: Seg[]) => segs.map((s) => s.text).join("");
const hasText = (segs: Seg[]) => plain(segs).trim() !== "" && !/^[—\-–]$/.test(plain(segs).trim());

/** 開頭的「標籤：」切掉（例如「句型」「⚠️易錯」「例（老師）」） */
function splitLabel(segs: Seg[]): { label: string | null; segs: Seg[] } {
  const m = /^([^：:]{1,14})[：:]\s*/.exec(plain(segs));
  if (!m || /[、。]/.test(m[1])) return { label: null, segs };
  let cut = m[0].length;
  const rest: Seg[] = [];
  for (const s of segs) {
    if (cut >= s.text.length) {
      cut -= s.text.length;
      continue;
    }
    rest.push({ ...s, text: s.text.slice(cut) });
    cut = 0;
  }
  return { label: m[1].trim(), segs: rest };
}

type Kind = "pattern" | "explain" | "examples" | "mistakes";
function kindOf(label: string): Kind | null {
  if (label.includes("句型")) return "pattern";
  if (/說明|内容|內容/.test(label)) return "explain";
  if (label.startsWith("例")) return "examples";
  if (label.includes("易錯")) return "mistakes";
  return null; // 逐字、出處…不顯示
}

/** 條列底下的子條列攤平成一行一行 */
const lines = (blocks: NoteBlock[] = []): Seg[][] => blocks.flatMap((b) => [b.segs, ...lines(b.children)].filter(hasText));

/** 「例：A。／B。」用「／」分句 */
export function splitSentences(segs: Seg[]): Seg[][] {
  const out: Seg[][] = [[]];
  for (const s of segs)
    s.text.split("／").forEach((part, i) => {
      if (i > 0) out.push([]);
      if (part) out.at(-1)!.push({ ...s, text: part });
    });
  return out.filter(hasText);
}

/** 例句表格：「出處」「理由」不要；「說明」「中文」當補充；其他欄（例句／問／答／推薦）用「→」接起來 */
function tableExamples(t: NoteBlock): Example[] {
  const rows = t.rows ?? [];
  const head = t.header ? rows[0].map(plain) : null;
  const body = t.header ? rows.slice(1) : rows;
  const jaCols = head ? head.flatMap((h, i) => (/出處|說明|備註|理由|中文/.test(h) ? [] : [i])) : [0];
  const noteCol = head ? head.findIndex((h) => /說明|中文/.test(h)) : -1;
  return body.flatMap((r) => {
    const parts = jaCols.map((i) => r[i] ?? []).filter(hasText);
    if (!parts.length) return [];
    const ja = parts.flatMap((p, i) => (i ? [{ text: " → ", bold: false }, ...p] : p));
    return [{ ja, note: noteCol >= 0 && r[noteCol] && hasText(r[noteCol]) ? plain(r[noteCol]) : "" }];
  });
}

export function parseNoteGrammar(blocks: NoteBlock[]): GrammarPoint[] {
  const out: GrammarPoint[] = [];
  let inGrammar = false;
  let kind: Kind | null = null;
  for (const b of blocks) {
    const text = plain(b.segs).trim();
    if (b.type === "heading_1" || b.type === "heading_2") {
      inGrammar = text.includes("文法");
      continue;
    }
    if (!inGrammar) continue;
    const m = CIRCLED.exec(text);
    if (b.type === "paragraph" && m) {
      out.push({ no: m[1], title: text.slice(m[0].length), pattern: [], explain: [], examples: [], mistakes: [] });
      kind = null;
      continue;
    }
    const point = out.at(-1);
    if (!point) continue;
    if (b.type === "table") {
      if (kind === "examples") point.examples.push(...tableExamples(b));
      continue;
    }
    if (!["bulleted_list_item", "numbered_list_item", "paragraph"].includes(b.type) || !text) continue;
    const { label, segs } = splitLabel(b.segs);
    if (label !== null) kind = kindOf(label);
    if (!kind) continue;
    const ls = [segs, ...lines(b.children)].filter(hasText);
    if (kind === "examples") point.examples.push(...ls.flatMap(splitSentences).map((ja) => ({ ja, note: "" })));
    else point[kind].push(...ls);
  }
  for (const p of out) p.examples = p.examples.slice(0, EXAMPLES);
  return out;
}
