import { NextResponse } from "next/server";

// 暫時的測試：抓多言語多読的免費書單頁（公開頁面），確認結構後會刪掉
const URLS = ["https://tadoku.org/japanese/free-books/"];

export const dynamic = "force-dynamic";

export async function GET() {
  const out = await Promise.all(
    URLS.map(async (url) => {
      try {
        const r = await fetch(url, { cache: "no-store", headers: { "user-agent": "Mozilla/5.0 StudyHub personal reader" } });
        const html = await r.text();
        const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
          .map((m) => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }))
          .filter((l) => /free-books|level|レベル|\.pdf/i.test(l.href + l.text));
        const at = html.indexOf("book-search?level=l-start");
        const second = html.indexOf("book-search?level=l-start", at + 30);
        return {
          url,
          status: r.status,
          bookLinkCount: links.length,
          entry1: html.slice(Math.max(0, at - 2500), at + 1500),
          entry2: html.slice(second - 200, second + 1500),
          listStart: html.slice(html.indexOf("freebooks-list") - 200, html.indexOf("freebooks-list") + 800),
        };
      } catch (e) {
        return { url, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return NextResponse.json(out);
}
