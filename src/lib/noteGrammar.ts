// 課堂筆記頁「## 文法（全部）」：「**① 〜ために、〜（目的）**」一段＋底下條列「句型：…」「說明：…」「例：…／…」

export type Seg = { text: string; bold: boolean };
export type NoteBlock = { type: string; segs: Seg[] };
export type GrammarBullet = { label: string | null; segs: Seg[] };
export type GrammarPoint = { no: string; title: string; bullets: GrammarBullet[] };

const CIRCLED = /^\s*([①-⑳])\s*/;
const plain = (segs: Seg[]) => segs.map((s) => s.text).join("");

/** 開頭的「標籤：」切掉（標籤 10 個字以內，例如「句型」「⚠️易錯」「例（板書）」） */
function splitLabel(segs: Seg[]): GrammarBullet {
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

export function parseNoteGrammar(blocks: NoteBlock[]): GrammarPoint[] {
  const out: GrammarPoint[] = [];
  let inGrammar = false;
  for (const b of blocks) {
    const text = plain(b.segs).trim();
    if (b.type === "heading_1" || b.type === "heading_2") {
      inGrammar = text.includes("文法");
      continue;
    }
    if (!inGrammar || !text) continue;
    const m = CIRCLED.exec(text);
    if (b.type === "paragraph" && m) {
      out.push({ no: m[1], title: text.slice(m[0].length), bullets: [] });
      continue;
    }
    const point = out.at(-1);
    if (point && (b.type === "bulleted_list_item" || b.type === "numbered_list_item" || b.type === "paragraph")) point.bullets.push(splitLabel(b.segs));
  }
  return out;
}
