// 多読書庫：NPO 多言語多読「無料の読みもの」的書單（CC BY-NC-ND 4.0）。
// 只取書名、級數、封面和連結；閱讀時打開原網站，不轉載內容。

export const TADOKU_URL = "https://tadoku.org/japanese/free-books/";
export const TADOKU_LEVELS = ["Start", "0", "1", "2", "3", "4", "5"] as const;
export type TadokuLevel = (typeof TADOKU_LEVELS)[number];

export type TadokuBook = {
  id: string;
  title: string;
  level: TadokuLevel;
  url: string;
  cover: string | null;
  /** 網站上的標記，例如「ふりがな付き」「音声あり」 */
  tags: string[];
};

const LEVEL_OF: Record<string, TadokuLevel> = { "l-start": "Start", l0: "0", l1: "1", l2: "2", l3: "3", l4: "4", l5: "5" };
// 這些是分類或連結，不是書的特色，不顯示
const HIDE_TAGS = new Set(["無料の読みもの", "レベル別読みもの", "電子書籍あり"]);

const clean = (s: string) =>
  s
    .replace(/<rt>[\s\S]*?<\/rt>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/\s+/g, " ")
    .trim();

/** 書單頁 HTML → 書（同一本只留一次） */
export function parseTadoku(html: string): TadokuBook[] {
  const books = new Map<string, TadokuBook>();
  const chunks = html.split('data-order-level="').slice(1);
  for (const chunk of chunks) {
    const level = LEVEL_OF[chunk.slice(0, chunk.indexOf('"'))];
    const link = chunk.match(/href="(https:\/\/tadoku\.org\/japanese\/book\/(\d+)\/)"/);
    const title = chunk.match(/class="bl-title">\s*<a[^>]*>([\s\S]*?)<\/a>/);
    if (!level || !link || !title) continue;
    const thumb = chunk.match(/class="bl-thumb">[\s\S]*?<img[^>]*src="([^"]+)"/);
    const icons = chunk.slice(chunk.indexOf('class="bl-icons"'), chunk.indexOf("</ul>", chunk.indexOf('class="bl-icons"')));
    const tags = [...icons.matchAll(/title="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((t) => !/^Level /.test(t) && !HIDE_TAGS.has(t));
    if (!books.has(link[2]))
      books.set(link[2], { id: link[2], title: clean(title[1]), level, url: link[1], cover: thumb?.[1] ?? null, tags: [...new Set(tags)] });
  }
  return [...books.values()];
}

export type TadokuDetail = {
  /** YouTube 影片 ID（書頁畫面＋朗讀） */
  youtube: string | null;
  /** 朗讀 mp3 */
  audio: string | null;
  /** PDF：e＝電子版、p＝列印版 */
  pdf: string[];
};

/** 書的頁面 → 影片、朗讀、PDF 連結 */
export function parseTadokuBook(html: string): TadokuDetail {
  const yt = html.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/);
  const audio = html.match(/https:\/\/tadoku\.org\/[^"'\s]+\.(?:mp3|m4a)/);
  const pdf = [...new Set([...html.matchAll(/https:\/\/tadoku\.org\/[^"'\s]+\.pdf/g)].map((m) => m[0]))];
  return { youtube: yt?.[1] ?? null, audio: audio?.[0] ?? null, pdf };
}
