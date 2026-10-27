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
        const url = b.audio.file.url;
        const r = await fetch(url, { headers: { Range: "bytes=0-0" } });
        const total = r.headers.get("content-range")?.split("/")[1];
        await r.arrayBuffer();
        out.push({ name: decodeURIComponent(new URL(url).pathname.split("/").pop() ?? ""), bytes: Number(total) || null });
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
  return NextResponse.json({ count: out.length, out: out.map((o) => `${o.name} ${o.bytes}`) });
}
