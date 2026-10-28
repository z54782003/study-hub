import { NextResponse } from "next/server";
import { probeDetails } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 暫時：檢查 N3 單字／文型／漢字詳解（只讀 Notion；測完刪掉）
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return NextResponse.json(await probeDetails(u.get("kind") ?? "words", Number(u.get("lo") ?? 0), Number(u.get("hi") ?? 100)));
}
