// 臨時：看多読書頁的朗讀寫法（查完就刪）
import { NextResponse } from "next/server";
import { getTadokuBooks } from "@/lib/data";
import { parseTadokuBook } from "@/lib/tadoku";

export async function GET() {
  const books = (await getTadokuBooks()).slice(0, 60);
  const out: unknown[] = [];
  for (const b of books.slice(0, 4)) {
    const html = await (await fetch(b.url)).text();
    const hits = [...html.matchAll(/.{0,160}(?:\.mp3|\.m4a|<audio|<iframe|soundcloud|朗読|youtu).{0,160}/gi)].map((m) => m[0].replace(/\s+/g, " ")).slice(0, 15);
    out.push({ id: b.id, title: b.title, tags: b.tags, parsed: parseTadokuBook(html), hits });
  }
  return NextResponse.json({ out });
}
