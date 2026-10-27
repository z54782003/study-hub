// N3 單字／文型的詳解（AI 產生一次，存在該 Notion 頁的內文，之後直接讀）。
// 內文格式（在 Notion 裡也看得懂）：
//   ### 📘 詳解
//   用法：…
//   接續：…            （文型才有，可多段）
//   搭配：目標を立てる＝訂目標
//   例句：日文｜かな｜中文
//   比較：…

export type N3Example = { ja: string; kana: string; zh: string };
export type N3Detail = {
  usage: string;
  forms: string[];
  collocations: { ja: string; zh: string }[];
  examples: N3Example[];
  compare: string;
};

export const DETAIL_HEADING = "📘 詳解";

/** 寫回 Notion 的段落（不含標題） */
export function detailLines(d: N3Detail): string[] {
  return [
    d.usage && `用法：${d.usage}`,
    ...d.forms.map((f) => `接續：${f}`),
    ...d.collocations.map((c) => `搭配：${c.ja}＝${c.zh}`),
    ...d.examples.map((e) => `例句：${e.ja}｜${e.kana}｜${e.zh}`),
    d.compare && `比較：${d.compare}`,
  ].filter((x): x is string => Boolean(x));
}

/** 頁面內文 → 詳解；沒有「📘 詳解」標題就回傳 null */
export function parseDetail(blocks: { type: string; text: string }[]): N3Detail | null {
  const start = blocks.findIndex((b) => b.type.startsWith("heading") && b.text.trim().startsWith(DETAIL_HEADING));
  if (start < 0) return null;
  const d: N3Detail = { usage: "", forms: [], collocations: [], examples: [], compare: "" };
  for (const b of blocks.slice(start + 1)) {
    if (b.type.startsWith("heading")) break;
    const m = /^(用法|接續|搭配|例句|比較)[：:]\s*(.*)$/s.exec(b.text.trim());
    if (!m) continue;
    const [, label, body] = m;
    if (label === "用法") d.usage = d.usage ? `${d.usage}\n${body}` : body;
    else if (label === "比較") d.compare = d.compare ? `${d.compare}\n${body}` : body;
    else if (label === "接續") d.forms.push(body);
    else if (label === "搭配") {
      const [ja, ...zh] = body.split("＝");
      d.collocations.push({ ja: ja.trim(), zh: zh.join("＝").trim() });
    } else {
      const [ja, kana = "", ...zh] = body.split("｜");
      d.examples.push({ ja: ja.trim(), kana: kana.trim(), zh: zh.join("｜").trim() });
    }
  }
  return d;
}
