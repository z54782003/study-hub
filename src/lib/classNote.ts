// 「今天的課」卡片：把課堂筆記（一整行 ①〜⑩）和標題拆成好讀的結構

export type NoteItem = { label: string | null; body: string; kind: "exam" | "notice" | "homework" | "normal" };

const CIRCLED = /[①-⑳]/;

/** 「①連絡:… ②漢字:…」→ 每個編號一項；沒有編號就依換行分。「※」開頭的備註另外回傳。 */
export function splitNumbered(text: string): { items: string[]; note: string | null } {
  let note: string | null = null;
  const noteAt = text.search(/※/);
  if (noteAt >= 0) {
    note = text.slice(noteAt).trim();
    text = text.slice(0, noteAt);
  }
  const parts = CIRCLED.test(text) ? text.split(CIRCLED) : text.split(/\n+/);
  return { items: parts.map((p) => p.trim().replace(/[、，,\s]+$/, "")).filter(Boolean), note };
}

/** 「漢字:体・色」→ label「漢字」；冒號要出現在前 12 個字內才算標籤 */
export function labelItem(item: string): NoteItem {
  const m = item.match(/^([^:：(（]{1,12})[:：]\s*([\s\S]+)$/);
  const label = m ? m[1].trim() : null;
  const body = m ? m[2].trim() : item;
  const head = label ?? body.slice(0, 12);
  const kind = /テスト|試験|考試/.test(head)
    ? "exam"
    : /連絡|お知らせ|通知/.test(head)
      ? "notice"
      : /宿題|作業/.test(head)
        ? "homework"
        : "normal";
  return { label, body, kind };
}

/** 「・」切開，但括號裡的不切（漢字（体・色・黄・赤）要留在一起） */
function splitDots(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "（" || ch === "(") depth++;
    if (ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "・" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export type ClassTitle = { lesson: string | null; topic: string; points: string[]; pages: string | null };

/** 「10/26（月）できる L3｜ST2 夢に向かって・〜ために・漢字（体・色）／本冊p.48–51」 */
export function parseClassTitle(title: string): ClassTitle {
  const t = title.replace(/^\s*\d{1,2}\/\d{1,2}（.）\s*/, "");
  const bar = t.indexOf("｜");
  const lesson = bar >= 0 ? t.slice(0, bar).trim() : null;
  let rest = bar >= 0 ? t.slice(bar + 1) : t;
  let pages: string | null = null;
  const slash = rest.lastIndexOf("／");
  if (slash >= 0 && /p\.|ページ|頁/.test(rest.slice(slash))) {
    pages = rest.slice(slash + 1).trim();
    rest = rest.slice(0, slash);
  }
  const [topic = rest.trim(), ...points] = splitDots(rest);
  return { lesson, topic, points, pages };
}

/** 預習頁的「今日課次」很長：第一個「，」之前是課，後面是補充 */
export function splitLesson(text: string): { main: string; detail: string | null } {
  const i = text.search(/[，,]/);
  return i > 0 ? { main: text.slice(0, i).trim(), detail: text.slice(i + 1).trim() || null } : { main: text.trim(), detail: null };
}
