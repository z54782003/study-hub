import { NextResponse } from "next/server";
import { getPage } from "@/lib/notion";

export const dynamic = "force-dynamic";

// 暫時：確認 Notion「背誦日_K」公式（測完刪掉）
export async function GET() {
  const ids = ["3f7097c57668811490a3fbfd1ecf46df", "3f3097c5766881c1be74ea6576f727bb", "2abfb922e0b349bda3884e2a1ddc0011"];
  const out = await Promise.all(ids.map(async (id) => (await getPage(id)).properties["背誦日_K"]));
  return NextResponse.json(out);
}
