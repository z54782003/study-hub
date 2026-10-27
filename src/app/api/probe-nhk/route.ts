import { NextResponse } from "next/server";

// 暫時的測試：從 Vercel 主機看 NHK Easy 抓不抓得到（只抓固定網址，確認後會刪掉）
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const get = (url: string) => fetch(url, { headers: { "user-agent": UA }, cache: "no-store" });

function around(s: string, re: RegExp, n = 3, w = 300) {
  const out: string[] = [];
  for (const m of s.matchAll(new RegExp(re.source, "g"))) {
    out.push(s.slice(Math.max(0, m.index! - w), m.index! + w));
    if (out.length >= n) break;
  }
  return out;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const top = await (await get("https://news.web.nhk/news/easy/")).text();
  const links = [...new Set([...top.matchAll(/\/news\/easy\/(ne\d{10,})\/?/g)].map((m) => m[1]))];
  const report: Record<string, unknown> = {
    links: links.slice(0, 10),
    tokenHints: around(top, /token|jwt|Authorization/i, 4, 200),
    apiHints: [...new Set([...top.matchAll(/https?:\/\/[a-z0-9.-]*nhk[a-z0-9./_-]*(api|json)[a-z0-9./_?=-]*/gi)].map((m) => m[0]))].slice(0, 20),
  };
  if (links[0]) {
    for (const path of [`https://news.web.nhk/news/easy/${links[0]}/${links[0]}.html`, `https://news.web.nhk/news/easy/${links[0]}/`]) {
      const r = await get(path);
      const html = await r.text();
      report[path] = {
        status: r.status,
        final: r.url,
        length: html.length,
        rubyCount: (html.match(/<ruby/g) ?? []).length,
        rubySample: around(html, /<ruby/, 1, 400),
        audioHints: [...new Set([...html.matchAll(/[^"'\s]*(m3u8|\.mp3|\.m4a|audio)[^"'\s]*/gi)].map((m) => m[0]))].slice(0, 15),
        titleSample: around(html, /<h1/, 1, 300),
      };
    }
  }
  return NextResponse.json(report);
}
