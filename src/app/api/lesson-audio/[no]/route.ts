import { NextResponse } from "next/server";
import { lessonAudioUrl } from "@/lib/data";

export const dynamic = "force-dynamic";

/** 課文音檔：轉到 Notion 當下有效的檔案網址（Notion 網址一小時後失效，不能直接放在頁面上） */
export async function GET(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  const key = (await params).no;
  if (!/^(?:[ABC]\d{2}|\d{3})$/.test(key)) return NextResponse.json({ error: "bad track" }, { status: 400 });
  const url = await lessonAudioUrl(key).catch(() => null);
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
}
