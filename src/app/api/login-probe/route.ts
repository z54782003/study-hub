import { NextResponse } from "next/server";
import { today } from "@/lib/data";
import { importLesson } from "@/lib/vocabImport";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 暫時：從課本索引補單字庫（用完刪掉）
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const n = Number(u.get("lesson"));
  if (!(n >= 8 && n <= 10)) return NextResponse.json({ error: "lesson?" }, { status: 400 });
  try {
    return NextResponse.json(await importLesson(n, u.get("apply") === "yes", today()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
