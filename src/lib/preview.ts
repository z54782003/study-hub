import { todayISO } from "./dates";

export type ChildPage = { id: string; title: string; createdTime: string };

/**
 * 找今天的 W3 預習頁：先比標題開頭的日期（「10/26（月）預習｜…」，允許前面有 emoji），
 * 對不到就退而用「今天建立的那一頁」——預習排程曾把東京 10/26 早上產生的頁標成 10/25。
 */
export function pickPreviewPage(pages: ChildPage[], day: string, tz: string): ChildPage | null {
  const [, m, d] = day.split("-");
  const dates = [`${Number(m)}/${Number(d)}`, `${m}/${d}`];
  const byTitle = pages.find((p) => {
    const t = p.title.replace(/^[^\d]*/, "");
    return dates.some((x) => t.startsWith(x) && !/\d/.test(t.charAt(x.length)));
  });
  if (byTitle) return byTitle;
  const createdToday = pages.filter((p) => todayISO(tz, new Date(p.createdTime)) === day);
  return createdToday.sort((a, b) => b.createdTime.localeCompare(a.createdTime))[0] ?? null;
}

/** 預習頁的區塊，簡化成解析需要的樣子；表格附上每列的儲存格文字 */
export type SimpleBlock = { type: string; text: string; boldStart: boolean; rows?: string[][] };

export type PreviewSummary = {
  lesson: string | null;
  exam: string | null;
  /** 文法區的標題（例：「L3 全課文法快速複習（今天沒有新文法…）」），用來說明這份清單是什麼 */
  grammarTitle: string | null;
  grammar: string[];
  /** 「⚠️ 易混淆總整理」這類補充說明 */
  grammarNote: string | null;
};

const LABELS = { lesson: ["今日課次"], exam: ["考試預告", "今日考試", "考試"] };

/** callout 裡「今日課次：…」「⚠️ 今日考試：…」這種一行一個標籤的內容 */
function pickLabel(lines: string[], labels: string[]): string | null {
  for (const raw of lines) {
    const l = raw.replace(/^[^\p{L}\p{N}]+/u, ""); // 去掉開頭的 ⚠️、🎯 等符號
    for (const label of labels) {
      const m = l.match(new RegExp(`^${label}[^：:]{0,12}[：:]\\s*(.+)$`));
      if (m) return m[1].replace(/^[—–-]+/, "").trim();
    }
  }
  return null;
}

const isNote = (t: string) => /^[⚠️❗※]|易混淆|注意/.test(t);

/**
 * 從 W3 預習頁抓重點：
 * - 所有 callout 裡的「今日課次」「考試預告／今日考試」（第一個 callout 可能只是修正說明）
 * - 標題含「文法」的段落底下：粗體開頭的段落（文法點），或表格的第一欄（＋「中文」欄）
 * - 文法區裡「⚠️ 易混淆…」的段落另外當補充說明
 */
export function summarizePreview(blocks: SimpleBlock[]): PreviewSummary {
  const lines = blocks
    .filter((b) => b.type === "callout")
    .flatMap((b) => b.text.split("\n"))
    .map((l) => l.trim())
    .filter(Boolean);

  const grammar: string[] = [];
  let grammarTitle: string | null = null;
  let grammarNote: string | null = null;
  const start = blocks.findIndex((b) => b.type.startsWith("heading") && b.text.includes("文法"));
  if (start >= 0) {
    grammarTitle = blocks[start].text.trim();
    for (const b of blocks.slice(start + 1)) {
      if (b.type.startsWith("heading")) break;
      if (b.type === "table" && b.rows?.length) {
        const [header, ...rows] = b.rows;
        const zh = header.findIndex((h) => /中文|意思/.test(h));
        for (const r of rows) {
          if (!r[0]) continue;
          // 「文法\t中文」：畫面上中文另起一行
          grammar.push(zh > 0 && r[zh] ? `${r[0]}\t${r[zh]}` : r[0]);
        }
      } else if (b.type === "paragraph" && b.text) {
        if (isNote(b.text)) grammarNote ??= b.text.replace(/^⚠️\s*/, "").trim();
        else if (b.boldStart) grammar.push(b.text.replace(/（[^）]*）\s*$/, "").trim());
      }
    }
  }
  return { lesson: pickLabel(lines, LABELS.lesson), exam: pickLabel(lines, LABELS.exam), grammarTitle, grammar, grammarNote };
}
