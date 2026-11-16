import { NextResponse } from "next/server";
import { setClassNoteReview } from "@/lib/data";

/** 課堂筆記「標記已複習」：{ id, value }，value 是「複習」欄的選項名稱 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; value?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const value = typeof body?.value === "string" ? body.value : "";
  if (!/^[0-9a-f-]{32,36}$/i.test(id) || !value) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await setClassNoteReview(id, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
