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
