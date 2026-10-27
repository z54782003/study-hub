import { NextResponse } from "next/server";
import { getTadokuDetail, getVoaArticle, getVoaFeed } from "@/lib/data";

// 暫時：確認正式環境的解析結果（只回傳摘要），確認後刪掉
export const dynamic = "force-dynamic";
export async function GET() {
  const [feed, art, book] = await Promise.all([
    getVoaFeed("stories").catch((e) => String(e)),
    getVoaArticle("7998765").catch((e) => String(e)),
    getTadokuDetail("40182").catch((e) => String(e)),
  ]);
  return NextResponse.json({
    feed: typeof feed === "string" ? feed : { n: feed.length, first: feed[0] },
    article:
      typeof art === "string"
        ? art
        : { title: art.title, audio: art.audio, paragraphs: art.paragraphs.length, first: art.paragraphs[0], last: art.paragraphs.at(-1), words: art.words, credit: art.credit },
    book,
  });
}
