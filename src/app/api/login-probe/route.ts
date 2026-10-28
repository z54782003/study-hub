import { NextResponse } from "next/server";
import { getN3Detail } from "@/lib/data";

export const dynamic = "force-dynamic";

// 暫時：測一個漢字的詳解（測完刪掉）
export async function GET() {
  try {
    return NextResponse.json(await getN3Detail("1f56a5c264994106873fc57d8ec28677"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
