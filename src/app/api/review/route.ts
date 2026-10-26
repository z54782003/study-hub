import { NextResponse } from "next/server";
import { getReviewItems } from "@/lib/data";
import { parseSource } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// src=due（預設）｜mistakes｜bank｜vocab，篩選條件見 lib/reviewSource.ts
export async function GET(req: Request) {
  try {
    return NextResponse.json({ items: await getReviewItems(parseSource(new URL(req.url).searchParams)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
