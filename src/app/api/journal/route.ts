import { NextResponse } from "next/server";
import { logJournal } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { minutes?: unknown } | null;
  const minutes = typeof body?.minutes === "number" && body.minutes > 0 ? Math.min(body.minutes, 240) : 0;
  try {
    await logJournal(minutes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
