import { NextResponse } from "next/server";
import { loadTedTalk } from "@/lib/ted";
import { mockTedTalk } from "@/lib/mock";
import { hasNotion } from "@/lib/notion";

export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "缺少 url" }, { status: 400 });
  if (!hasNotion() && process.env.MOCK === "1") return NextResponse.json(mockTedTalk());
  try {
    return NextResponse.json(await loadTedTalk(url));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
