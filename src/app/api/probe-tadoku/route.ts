import { NextResponse } from "next/server";

// 暫時的測試：抓多言語多読的免費書單頁（公開頁面），確認結構後會刪掉
const URLS = ["https://tadoku.org/japanese/free-books/", "https://tadoku.org/japanese/en/free-books-en/"];

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
        return { url, status: r.status, length: html.length, links: links.slice(0, 200), sample: html.slice(html.indexOf("<main") > 0 ? html.indexOf("<main") : 0).slice(0, 3000) };
      } catch (e) {
        return { url, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return NextResponse.json(out);
}
