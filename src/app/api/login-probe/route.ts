import { NextResponse } from "next/server";
import { getClassNote } from "@/lib/data";

export const dynamic = "force-dynamic";

// 暫時：看課堂筆記的文法解析結果（只讀 Notion；測完刪掉）
export async function GET(req: Request) {
  return NextResponse.json(await getClassNote(new URL(req.url).searchParams.get("id") ?? ""));
}
