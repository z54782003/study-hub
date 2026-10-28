import { NextResponse } from "next/server";
import { probeDetails } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 暫時：檢查 Notion AI 建的詳解（測完刪掉）
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return NextResponse.json(await probeDetails(u.get("kind") === "grammar" ? "grammar" : "word", Number(u.get("lo") ?? 0), Number(u.get("hi") ?? 360)));
}
