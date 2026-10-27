// 臨時：列出課文音檔頁的檔名與大小（查完就刪）
import { NextResponse } from "next/server";
import { notion } from "@/lib/notion";

export async function GET() {
  const out: { name: string; bytes: number | null }[] = [];
  let cursor: string | undefined;
  try {
    do {
      const res = await notion().blocks.children.list({ block_id: "406097c5-7668-810e-ade7-e0954334c539", start_cursor: cursor, page_size: 100 });
      for (const b of res.results as { type: string; audio?: { type: string; name?: string; file?: { url: string } } }[]) {
        if (b.type !== "audio" || !b.audio?.file) continue;
        const r = await fetch(b.audio.file.url, { method: "HEAD" });
        out.push({ name: b.audio.name ?? "", bytes: Number(r.headers.get("content-length")) || null });
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
  return NextResponse.json({ count: out.length, out: out.map((o) => `${o.name} ${o.bytes}`) });
}
