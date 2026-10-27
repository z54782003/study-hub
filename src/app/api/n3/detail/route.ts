import { NextResponse } from "next/server";
import { getN3Detail } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{1,40}$/.test(id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await getN3Detail(id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
