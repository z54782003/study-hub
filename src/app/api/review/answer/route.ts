import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/data";
import type { AnswerPayload } from "@/lib/types";

export const maxDuration = 60;

const KINDS = new Set(["quiz", "n3", "grammar", "vocab", "verb", "kanji"]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as AnswerPayload | null;
  if (!body || !KINDS.has(body.kind) || typeof body.id !== "string" || typeof body.correct !== "boolean") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const method = ["自動比對", "AI", "自評"].includes(String(body.method)) ? body.method : undefined;
  try {
    await submitAnswer({
      kind: body.kind,
      id: body.id,
      correct: body.correct,
      method,
      answer: typeof body.answer === "string" ? body.answer.slice(0, 500) : undefined,
      feedback: typeof body.feedback === "string" ? body.feedback.slice(0, 1000) : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt.slice(0, 200) : undefined,
      reference: typeof body.reference === "string" ? body.reference.slice(0, 200) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
