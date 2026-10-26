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

/** 預習頁的區塊，簡化成解析需要的樣子 */
export type SimpleBlock = { type: string; text: string; boldStart: boolean };

export type PreviewSummary = { lesson: string | null; exam: string | null; grammar: string[] };

/**
 * 從 W3 預習頁抓重點：第一個 callout 裡的「今日課次」「考試預告」兩行，
 * 以及「文法點解說」標題底下每個粗體開頭的段落（文法點標題）。
 */
export function summarizePreview(blocks: SimpleBlock[]): PreviewSummary {
  const callout = blocks.find((b) => b.type === "callout")?.text ?? "";
  const lines = callout.split("\n").map((l) => l.trim()).filter(Boolean);
  const pick = (label: string) => lines.find((l) => l.startsWith(label))?.replace(new RegExp(`^${label}[：:]\\s*`), "") ?? null;

  const grammar: string[] = [];
  const start = blocks.findIndex((b) => b.type.startsWith("heading") && b.text.includes("文法"));
  if (start >= 0) {
    for (const b of blocks.slice(start + 1)) {
      if (b.type.startsWith("heading")) break;
      if (b.type === "paragraph" && b.boldStart && b.text) grammar.push(b.text.replace(/（[^）]*）\s*$/, "").trim());
    }
  }
  return { lesson: pick("今日課次"), exam: pick("考試預告"), grammar };
}
