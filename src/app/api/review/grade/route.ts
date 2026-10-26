import { NextResponse } from "next/server";
import { gradeQuiz } from "@/lib/data";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; answer?: unknown; choice?: unknown } | null;
  const choice = typeof body?.choice === "string" ? body.choice.slice(0, 2) : undefined;
  const id = typeof body?.id === "string" ? body.id : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim().slice(0, 500) : "";
  if (!id || !answer) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await gradeQuiz(id, answer, choice));
  } catch (e) {
    // AI 或 Notion 出錯時改成自評，不讓複習卡住
    console.error("批改失敗", e);
    return NextResponse.json({ correct: null, method: "自評", feedback: "", suggestion: "", error: e instanceof Error ? e.message : String(e) });
  }
}
