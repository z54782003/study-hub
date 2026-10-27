import { NextResponse } from "next/server";
import { setVocabStatus, VOCAB_STATUSES } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const status = VOCAB_STATUSES.find((s) => s === body?.status);
  if (!/^[\w-]{1,40}$/.test(id) || !status) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await setVocabStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
