import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/data";
import type { AnswerPayload } from "@/lib/types";

export const maxDuration = 60;

const KINDS = new Set(["quiz", "n3", "grammar"]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as AnswerPayload | null;
  if (!body || !KINDS.has(body.kind) || typeof body.id !== "string" || typeof body.correct !== "boolean") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    await submitAnswer(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
