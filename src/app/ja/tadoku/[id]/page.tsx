import { notFound } from "next/navigation";
import { ReadButton } from "../ReadButton";
import { AudioPlayer } from "@/components/AudioPlayer";
import { getTadokuBooks, getTadokuDetail, getTadokuLog } from "@/lib/data";
import { BackLink } from "@/components/BackLink";
import { pdfKind, pdfProxyPath } from "@/lib/tadoku";
import { PdfReader } from "@/components/PdfReader";
import { Icon } from "@/components/Icon";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

export const dynamic = "force-dynamic";
export const metadata = { title: "多読・Study Hub" };

export default async function TadokuBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const book = (await getTadokuBooks().catch(() => [])).find((b) => b.id === id);
  if (!book) notFound();
  const [detail, log] = await Promise.all([
    getTadokuDetail(id).catch(() => null),
    getTadokuLog().catch(() => ({}) as Awaited<ReturnType<typeof getTadokuLog>>),
  ]);
  const read = log[id];
  // 頁面裡直接讀：電子版優先，沒有就用第一個 PDF
  const readable = [...(detail?.pdf ?? [])].sort((x, y) => Number(pdfKind(x) !== "screen") - Number(pdfKind(y) !== "screen")).find((u) => pdfProxyPath(u));
  return (
    <>
      <BackLink href={`/ja/tadoku?level=${book.level}`}>多読書庫</BackLink>
      <div className="mt-1 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[34px] font-bold" lang="ja">
            {book.title}
          </h1>
          <p className="text-sm text-muted">
            {book.level === "Start" ? "入門" : `Level ${book.level}`}
            {book.tags.length > 0 && `・${book.tags.join("・")}`}
          </p>
        </div>
        <ReadButton id={id} initial={Boolean(read)} />
      </div>

      {detail === null && <p className="mb-3 text-sm text-bad">讀不到這本書的頁面，請到多読網站閱讀。</p>}

      {detail && !detail.audio && !detail.youtube && (
        <p className="mb-3 rounded-[14px] bg-card-2 px-4 py-3 text-sm text-ink-2">這本書的朗讀還在準備中（多読網站上還沒有），現在只能看 PDF。</p>
      )}

      {/* 有 mp3 就用底部的朗讀列；沒有 mp3 才放 YouTube 影片 */}
      {detail?.youtube && !detail.audio && (
        <details className="group card mb-3 overflow-hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-[15px] font-semibold">
            <Icon name="play" size={18} className="text-accent" />
            看朗讀影片（書頁＋聲音）
            <Icon name="chevron" size={16} stroke={2.4} className="ml-auto text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="aspect-video">
            <YouTubeEmbed id={detail.youtube} title={book.title} />
          </div>
        </details>
      )}

      {readable ? (
        <div className="mb-5">
          <PdfReader src={pdfProxyPath(readable)!} original={readable} title={book.title} />
        </div>
      ) : (
        detail?.pdf[0] && (
          <a href={detail.pdf[0]} target="_blank" rel="noreferrer" className="card mb-5 flex min-h-14 items-center gap-3 px-4 text-[15px] font-semibold">
            <Icon name="book" className="text-accent" />
            <span className="flex-1">開啟 PDF</span>
            <Icon name="external" size={18} stroke={2} className="text-muted" label="外部連結" />
          </a>
        )
      )}

      <a href={book.url} target="_blank" rel="noreferrer" className="mb-2 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent">
        在多読網站上看這本書
        <Icon name="external" size={14} stroke={2} />
      </a>

      {detail?.audio && (
        <>
          <div className="h-16" aria-hidden />
          <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-card px-4 py-2">
            <div className="mx-auto flex max-w-xl items-center gap-2 md:max-w-[760px]">
              <span className="shrink-0 text-xs font-bold text-muted">朗讀</span>
              <div className="min-w-0 flex-1">
                <AudioPlayer src={detail.audio} compact label="朗讀音檔" />
              </div>
            </div>
          </div>
        </>
      )}

      <p className="mb-4 text-xs leading-relaxed text-muted">
        © NPO 多言語多読「無料の読みもの」，CC BY-NC-ND 4.0。內容與朗讀直接來自多読網站和 YouTube，未經修改。
      </p>
    </>
  );
}
