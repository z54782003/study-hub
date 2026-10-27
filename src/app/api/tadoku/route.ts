import { NextResponse } from "next/server";
import { toggleTadokuRead } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !/^\d+$/.test(body.id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await toggleTadokuRead(body.id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
