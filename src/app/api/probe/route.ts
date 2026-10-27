import { NextResponse } from "next/server";

// 暫時的測試（確認後刪掉）：VOA 各 RSS 的名稱與最新日期、文章段落
const UA = { "user-agent": "Mozilla/5.0 StudyHub personal reader" };
const grab = async (url: string) => (await fetch(url, { headers: UA, cache: "no-store" })).text();

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const list = await grab("https://learningenglish.voanews.com/rssfeeds");
  const ids = [...new Set([...list.matchAll(/href="\/api\/([\w-]+)"/g)].map((m) => m[1]))];
  const feeds = await Promise.all(
    ["", ...ids].map(async (id) => {
      try {
        const x = await grab(`https://learningenglish.voanews.com/api/${id}`);
        const items = [...x.matchAll(/<item>[\s\S]*?<pubDate>([^<]+)<\/pubDate>/g)].map((m) => new Date(m[1]).toISOString().slice(0, 10));
        return { id, title: x.match(/<title>([^<]+)<\/title>/)?.[1], items: items.length, newest: items.sort().at(-1) };
      } catch (e) {
        return { id, error: String(e) };
      }
    }),
  );
  const art = await grab("https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html");
  const wsw = art.slice(art.indexOf('class="wsw"'));
  const paras = [...wsw.matchAll(/<(p|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1]}: ${m[2].replace(/<[^>]+>/g, "").trim()}`).slice(0, 80);
  return NextResponse.json({ feeds, paras });
}
