// VOA Learning English：文字、MP3 為美國政府公共領域內容（新聞社 AP／Reuters／AFP 的照片與報導除外，所以不取圖片）。
// 2025 年 3 月起停止更新，RSS 仍提供各單元最近 20 篇。

export const VOA_BASE = "https://learningenglish.voanews.com";

export const VOA_FEEDS = [
  { key: "stories", title: "American Stories", note: "慢速朗讀的美國文學", id: "zyg__l-vomx-tpetmty" },
  { key: "science", title: "Science & Technology", note: "科學與科技", id: "zmg_pl-vomx-tpeymtm" },
  { key: "health", title: "Health & Lifestyle", note: "健康與生活", id: "zmmpql-vomx-tpey-_q" },
  { key: "arts", title: "Arts & Culture", note: "藝術與文化", id: "zpyp_l-vomx-tpe_rym" },
  { key: "america", title: "All About America", note: "美國生活", id: "zbmroml-vomx-tpeqboo_" },
  { key: "asitis", title: "As It Is", note: "時事", id: "zkm-ql-vomx-tpej-rqi" },
  { key: "words", title: "Words and Their Stories", note: "片語的由來", id: "zmypyl-vomx-tpeyry_" },
  { key: "history", title: "U.S. History", note: "美國歷史", id: "zj_pvl-vomx-tpebb_v" },
  { key: "parks", title: "America's National Parks", note: "國家公園", id: "zqmiqol-vomx-tpei-mqp" },
] as const;
export type VoaFeedKey = (typeof VOA_FEEDS)[number]["key"];

export type VoaItem = { id: string; title: string; description: string; date: string };
export type VoaArticle = {
  title: string;
  audio: string | null;
  paragraphs: string[];
  /** Words in This Story：單字＋說明 */
  words: { term: string; def: string }[];
  credit: string[];
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function parseVoaFeed(xml: string): VoaItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const link = item.match(/<link>([^<]+)<\/link>/)?.[1] ?? "";
    const id = link.match(/\/(\d+)\.html/)?.[1];
    if (!id) return [];
    const pub = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    return [
      {
        id,
        title: decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
        description: decode(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ""),
        date: pub ? new Date(pub).toISOString().slice(0, 10) : "",
      },
    ];
  });
}

const CREDIT = /\b(wrote|adapted|edited|reported) (this|the) (story|report)|^I[’']m [A-Z][\w.]+( [A-Z][\w.]+)*\.?$/;

/** 文章頁 → 標題、音檔、段落、Words in This Story */
export function parseVoaArticle(html: string): VoaArticle {
  const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const audio = html.match(/https:\/\/voa-audio[^"'\s<&]+?\.mp3/)?.[0] ?? null;
  const start = html.indexOf('class="wsw"');
  const body = start >= 0 ? html.slice(start) : "";
  const paragraphs: string[] = [];
  const words: VoaArticle["words"] = [];
  const credit: string[] = [];
  let section: "text" | "words" | "done" = "text";
  for (const m of body.matchAll(/<(p|h2|h3)[^>]*>([\s\S]*?)<\/\1>/g)) {
    const tag = m[1];
    const t = decode(m[2]);
    if (tag !== "p") {
      // 標題：Words in This Story 開始收單字；其後的下一個標題、Related／Forum 表示內文結束
      if (/related|forum/i.test(t)) break;
      if (/words in this story/i.test(t)) section = "words";
      else if (section === "words") section = "done";
      continue;
    }
    if (!t || /^_+$/.test(t) || /no media source/i.test(t) || /^(share|print|see comments|follow us)$/i.test(t)) continue;
    if (section === "words") {
      const w = t.match(/^(.+?)\s*[–—-]\s*(.+)$/);
      if (w) words.push({ term: w[1].trim(), def: w[2].trim() });
      continue;
    }
    if (section === "text") {
      if (CREDIT.test(t)) credit.push(t);
      else paragraphs.push(t);
    }
  }
  return { title, audio, paragraphs, words, credit };
}
