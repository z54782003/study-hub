// できる日本語單字的順序：照「課本索引」📒 單字表（### 4-1｜生活を楽しむ（p.56–59） 底下的表格）排，分 ST1／ST2／補

export type IndexSection = { title: string; words: string[] };

/** 比對用：去掉「〜」「(お)」「(な)」「・する」 */
export const normWord = (s: string) =>
  s.replace(/[〜～\s]/g, "").replace(/^[（(]お[)）]/, "").replace(/[（(]な[)）]$/, "").replace(/・?する$/, "");

/** 「4-1｜生活を楽しむ（p.56–59）」→「4-1 生活を楽しむ」；「補｜話読聞書・もう一度聞こう（p.64・66）」→「補 話読聞書・もう一度聞こう」 */
export const sectionTitle = (h: string) => h.replace(/[（(]p\.[^）)]*[）)]\s*$/, "").replace("｜", " ").trim();

/** 單字庫的字照課本順序分段；課本表裡沒有的放最後「其他」 */
export function groupBySection<T extends { word: string }>(words: T[], sections: IndexSection[]): { title: string; words: T[] }[] {
  const pos = new Map<string, [number, number]>();
  sections.forEach((s, i) => s.words.forEach((w, j) => pos.has(normWord(w)) || pos.set(normWord(w), [i, j])));
  const out = sections.map((s) => ({ title: s.title, words: [] as (T & { _j: number })[] }));
  const rest: T[] = [];
  for (const w of words) {
    const p = pos.get(normWord(w.word));
    if (p) out[p[0]].words.push({ ...w, _j: p[1] });
    else rest.push(w);
  }
  return [
    ...out.filter((s) => s.words.length).map((s) => ({ title: s.title, words: s.words.sort((a, b) => a._j - b._j).map(({ _j, ...w }) => w as unknown as T) })),
    ...(rest.length ? [{ title: sections.length ? "其他（課本表以外）" : "", words: rest }] : []),
  ];
}
