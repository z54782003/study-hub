import { NextResponse } from "next/server";
import { gradeQuiz, gradeRecall } from "@/lib/data";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    answer?: unknown;
    choice?: unknown;
    recall?: { question?: unknown; reference?: unknown };
  } | null;
  const choice = typeof body?.choice === "string" ? body.choice.slice(0, 2) : undefined;
  const id = typeof body?.id === "string" ? body.id : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim().slice(0, 500) : "";
  if (!id || !answer) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const recall = body?.recall;
  try {
    // 單字・漢字・文型：題目和參考答案由前端帶來（同一份資料），直接請 AI 批改
    if (recall && typeof recall.question === "string" && typeof recall.reference === "string")
      return NextResponse.json(await gradeRecall(recall.question.slice(0, 300), recall.reference.slice(0, 1000), answer));
    return NextResponse.json(await gradeQuiz(id, answer, choice));
  } catch (e) {
    // AI 或 Notion 出錯：回傳原因，畫面上可以重試或跳過（不改成自評）
    console.error("批改失敗", e);
    return NextResponse.json({ correct: null, method: "自評", feedback: "", suggestion: "", error: e instanceof Error ? e.message : String(e) });
  }
}
