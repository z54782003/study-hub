import { NextResponse } from "next/server";

// 暫時的測試（確認後刪掉）：多読書頁的 YouTube 連結、VOA Learning English 的 RSS 與文章結構
const UA = { "user-agent": "Mozilla/5.0 StudyHub personal reader" };
const grab = async (url: string) => {
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    return { status: r.status, final: r.url, type: r.headers.get("content-type"), text: await r.text() };
  } catch (e) {
    return { status: 0, final: url, type: null, text: "", error: e instanceof Error ? e.message : String(e) };
  }
};
const uniq = (xs: string[]) => [...new Set(xs)];

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {};
  for (const id of ["40182", "64329"]) {
    const r = await grab(`https://tadoku.org/japanese/book/${id}/`);
    out[`book-${id}`] = {
      status: r.status,
      youtube: uniq([...r.text.matchAll(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/g)].map((m) => m[0])),
      audio: uniq([...r.text.matchAll(/https?:[^"'\s]+\.(?:mp3|m4a)/g)].map((m) => m[0])).slice(0, 5),
      pdf: uniq([...r.text.matchAll(/https?:[^"'\s]+\.pdf/g)].map((m) => m[0])).slice(0, 5),
    };
  }
  for (const url of [
    "https://learningenglish.voanews.com/api/",
    "https://learningenglish.voanews.com/api/zmg_pebmyp",
    "https://learningenglish.voanews.com/z/1689",
    "https://learningenglish.voanews.com/",
  ]) {
    const r = await grab(url);
    out[url] = {
      status: r.status,
      final: r.final,
      type: r.type,
      length: r.text.length,
      rss: uniq([...r.text.matchAll(/https?:\/\/learningenglish\.voanews\.com\/api\/[\w-]+/g)].map((m) => m[0])).slice(0, 15),
      mp3: uniq([...r.text.matchAll(/https?:[^"'\s<]+\.mp3/g)].map((m) => m[0])).slice(0, 3),
      articles: uniq([...r.text.matchAll(/https?:\/\/learningenglish\.voanews\.com\/a\/[\w-]+\/\d+\.html/g)].map((m) => m[0])).slice(0, 5),
      head: r.text.slice(0, 600),
    };
  }
  return NextResponse.json(out);
}
