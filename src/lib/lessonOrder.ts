// できる日本語單字的順序：照「課本索引」📒 單字表（### 4-1｜生活を楽しむ（p.56–59） 底下的表格）排，分 ST1／ST2／補

export type IndexSection = { title: string; words: string[] };

/** 比對用：去掉「〜」「(お)」「(な)」「・する」 */
export const normWord = (s: string) =>
  s.replace(/[〜～\s]/g, "").replace(/^[（(]お[)）]/, "").replace(/[（(]な[)）]$/, "").replace(/・?する$/, "");

/** 「4-1｜生活を楽しむ（p.56–59）」→「4-1 生活を楽しむ」；「補｜話読聞書・もう一度聞こう（p.64・66）」→「補 話読聞書・もう一度聞こう」 */
export const sectionTitle = (h: string) => h.replace(/[（(]p\.[^）)]*[）)]\s*$/, "").replace("｜", " ").trim();

/** 小節只留編號：「4-1 生活を楽しむ」→「4-1」；補充、課本表以外的字都歸「補充」 */
export const shortSection = (title: string) => /^\d+-\d+/.exec(title)?.[0] ?? "補充";

/** 單字庫的字照課本順序分段（4-1、4-2…，最後是「補充」：話読聞書、もう一度聞こう和課本表以外的字） */
export function groupBySection<T extends { word: string }>(words: T[], sections: IndexSection[]): { title: string; words: T[] }[] {
  const pos = new Map<string, number>();
  let n = 0;
  for (const s of sections) for (const w of s.words) if (!pos.has(normWord(w))) pos.set(normWord(w), n++);
  const sectionOf = new Map<string, string>();
  for (const s of sections) for (const w of s.words) if (!sectionOf.has(normWord(w))) sectionOf.set(normWord(w), shortSection(s.title));
  const order = [...new Set(sections.map((s) => shortSection(s.title)))];
  if (!sections.length) return words.length ? [{ title: "", words }] : [];
  if (!order.includes("補充")) order.push("補充");
  const groups = new Map(order.map((t) => [t, [] as T[]]));
  const sorted = [...words].sort((a, b) => (pos.get(normWord(a.word)) ?? Infinity) - (pos.get(normWord(b.word)) ?? Infinity));
  for (const w of sorted) groups.get(sectionOf.get(normWord(w.word)) ?? "補充")!.push(w);
  return order.map((title) => ({ title, words: groups.get(title)! })).filter((g) => g.words.length);
}
