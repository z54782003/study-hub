import { NextResponse } from "next/server";

// 暫時的測試：從 Vercel 主機看 NHK Easy 抓不抓得到（只抓固定網址，確認後會刪掉）
const URLS = [
  "https://www3.nhk.or.jp/news/easy/news-list.json",
  "https://www3.nhk.or.jp/news/easy/top-list.json",
  "https://www3.nhk.or.jp/news/easy/",
  "https://news.web.nhk/news/easy/",
  "https://news.web.nhk/news/easy/news-list.json",
];

export const dynamic = "force-dynamic";

export async function GET() {
  const out = await Promise.all(
    URLS.map(async (url) => {
      try {
        const r = await fetch(url, {
          headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" },
          redirect: "follow",
          cache: "no-store",
        });
        const body = await r.text();
        return { url, status: r.status, final: r.url, type: r.headers.get("content-type"), length: body.length, head: body.slice(0, 1500) };
      } catch (e) {
        return { url, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return NextResponse.json(out);
}
