import { NextResponse } from "next/server";
import { setPlannerTaskDone } from "@/lib/data";

/** Life Planner Tasks 打勾：{ id, done: true }；取消：{ id, done: false, prev: 原本的 Status } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; done?: unknown; prev?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{32,36}$/i.test(id) || typeof body?.done !== "boolean") return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await setPlannerTaskDone(id, body.done, typeof body.prev === "string" ? body.prev : null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
