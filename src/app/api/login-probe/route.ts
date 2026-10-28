import { NextResponse } from "next/server";
import { getN3Detail } from "@/lib/data";
import { hasReadings } from "@/lib/furigana";

export const dynamic = "force-dynamic";

// 暫時：看正式站讀到的「指定」詳解（只讀 Notion；測完刪掉）
export async function GET() {
  const d = await getN3Detail("3bf097c5766880d99ae0d148e9cd3cf6");
  return NextResponse.json({ examples: d?.examples.map((e) => ({ ja: e.ja, ruby: hasReadings(e.ja) })) });
}
