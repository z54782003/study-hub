import { NextResponse } from "next/server";
import { setEviuUnit } from "@/lib/data";

/** EVIU 單元：{ id, status?, studied? }；studied 是 YYYY-MM-DD 或 null（清掉） */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown; studied?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : undefined;
  const studied = body?.studied === null ? null : typeof body?.studied === "string" ? body.studied : undefined;
  if (!/^[0-9a-f-]{32,36}$/i.test(id) || (status === undefined && studied === undefined) || (studied && !/^\d{4}-\d{2}-\d{2}$/.test(studied)))
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await setEviuUnit(id, { status, studied });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
