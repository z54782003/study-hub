import { NextResponse } from "next/server";

// 暫時的測試（確認後刪掉）：VOA Learning English 文章頁與 RSS 列表的結構
const UA = { "user-agent": "Mozilla/5.0 StudyHub personal reader" };
const grab = async (url: string) => {
  const r = await fetch(url, { headers: UA, cache: "no-store" });
  return { status: r.status, text: await r.text() };
};
const around = (s: string, re: RegExp, w = 700) => {
  const i = s.search(re);
  return i < 0 ? null : s.slice(Math.max(0, i - 200), i + w);
};

export const dynamic = "force-dynamic";

export async function GET() {
  const feeds = await grab("https://learningenglish.voanews.com/rssfeeds");
  const feedLinks = [...feeds.text.matchAll(/<a[^>]+href="(\/api\/[\w-]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, "").trim()]);
  const rss = await grab("https://learningenglish.voanews.com/api/zmg_pebmyp");
  const item = around(rss.text, /<item>/, 1500);
  const art = await grab("https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html");
  return NextResponse.json({
    feedsStatus: feeds.status,
    feedLinks: feedLinks.slice(0, 60),
    rssItem: item,
    article: {
      status: art.status,
      mp3: [...new Set([...art.text.matchAll(/https?:[^"'\s<]+\.mp3[^"'\s<]*/g)].map((m) => m[0]))].slice(0, 5),
      body: around(art.text, /class="wsw"/, 2500),
      title: around(art.text, /<h1/, 400),
      json: around(art.text, /"@type"\s*:\s*"NewsArticle"/, 600),
    },
  });
}
