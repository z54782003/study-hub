import { NextResponse } from "next/server";
import { setTedDone } from "@/lib/data";

/** TED 做完：{ id, done: true }；取消：{ id, done: false, prev: "待做" | "今天做" } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; done?: unknown; prev?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{32,36}$/i.test(id) || typeof body?.done !== "boolean") return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const progress = await setTedDone(id, body.done, typeof body.prev === "string" ? body.prev : null);
    return NextResponse.json({ progress });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
