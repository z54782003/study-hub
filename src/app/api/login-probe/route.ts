import { NextResponse } from "next/server";
import { probeDetails } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 暫時：檢查 N3 詳解格式（只讀 Notion；測完刪掉）
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return NextResponse.json(await probeDetails(Number(u.get("lo") ?? 0), Number(u.get("hi") ?? 100)));
}
