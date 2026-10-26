import { NextResponse } from "next/server";
import { getMistakes, getReviewQueue } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode");
  try {
    // mode=mistakes：錯題區重測（一次最多 30 題，最近答錯的先）
    return NextResponse.json({ items: mode === "mistakes" ? (await getMistakes()).slice(0, 30) : await getReviewQueue() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
