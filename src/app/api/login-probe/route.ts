import { NextResponse } from "next/server";
import { probeDetails, today } from "@/lib/data";
import { importLesson } from "@/lib/vocabImport";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 暫時：從課本索引補單字庫（用完刪掉）
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const kind = u.get("kind");
  if (kind) return NextResponse.json(await probeDetails(kind === "grammar" ? "grammar" : "word", Number(u.get("lo") ?? 0), Number(u.get("hi") ?? 360)));
  const n = Number(u.get("lesson"));
  if (!(n >= 1 && n <= 15)) return NextResponse.json({ error: "lesson?" }, { status: 400 });
  try {
    return NextResponse.json(await importLesson(n, u.get("apply") === "yes", today()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
