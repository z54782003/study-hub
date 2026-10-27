import { NextResponse } from "next/server";
import { getTadokuBooks } from "@/lib/data";

// 暫時：確認正式環境解析得到書單（只回傳數量），確認後刪掉
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const books = await getTadokuBooks();
    const byLevel: Record<string, number> = {};
    for (const b of books) byLevel[b.level] = (byLevel[b.level] ?? 0) + 1;
    const tags: Record<string, number> = {};
    for (const b of books) for (const t of b.tags) tags[t] = (tags[t] ?? 0) + 1;
    return NextResponse.json({ total: books.length, byLevel, tags, sample: books.slice(0, 3).map((b) => [b.title, b.level, b.url, Boolean(b.cover)]) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
