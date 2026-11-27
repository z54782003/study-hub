import { NextResponse } from "next/server";
import { vocabAudioUrl } from "@/lib/data";

export const dynamic = "force-dynamic";

/** 單字、例句、搭配的發音檔（kind：w／e1／e2／u-內容雜湊）：轉到 Notion 當下有效的網址（頁面上帶的網址一小時後失效，過期才會走這裡）；沒有就 404，App 退回瀏覽器發音 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!/^[0-9a-f-]{32,36}$/i.test(id) || !/^(w|e1|e2|u-[0-9a-f]{8})$/.test(kind)) return new NextResponse("bad request", { status: 400 });
  try {
    const url = await vocabAudioUrl(id, kind);
    if (!url) return new NextResponse("not found", { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : String(e), { status: 502 });
  }
}
