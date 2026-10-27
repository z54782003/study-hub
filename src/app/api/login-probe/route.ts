import { NextResponse } from "next/server";
import { getN3Batch, getN3Detail } from "@/lib/data";

export const dynamic = "force-dynamic";

// 暫時：確認 N3 批次與詳解（測完刪掉）
export async function GET() {
  const b = await getN3Batch();
  const first = b.words[0];
  const g = b.grammar[0];
  const out: Record<string, unknown> = { words: b.words.length, list: b.words.map((w) => w.word).join(" "), grammar: b.grammar.map((x) => x.pattern) };
  try {
    out.word = { w: first?.word, d: first ? await getN3Detail(first.id) : null };
    out.g = { p: g?.pattern, d: g ? await getN3Detail(g.id) : null };
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(out);
}
