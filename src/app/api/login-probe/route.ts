import { NextResponse } from "next/server";
import { notion } from "@/lib/notion";
import { DS } from "@/lib/config";

export const dynamic = "force-dynamic";

// 暫時：量 Notion API 延遲（測完刪掉）
export async function GET() {
  const ms: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = Date.now();
    await notion().dataSources.query({ data_source_id: DS.n3Grammar, page_size: 1 });
    ms.push(Date.now() - t);
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, ms });
}
