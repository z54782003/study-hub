import { NextResponse } from "next/server";
import { addVocab } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { word?: unknown; sentence?: unknown; lang?: unknown } | null;
  const word = typeof body?.word === "string" ? body.word.trim() : "";
  const sentence = typeof body?.sentence === "string" ? body.sentence.trim() : "";
  const lang = body?.lang === "ja" ? "ja" : "en";
  if (!word || word.length > 80) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await addVocab(word, sentence, lang));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
