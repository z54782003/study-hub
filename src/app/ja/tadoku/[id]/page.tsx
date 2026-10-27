import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadButton } from "../ReadButton";
import { AudioPlayer } from "@/components/AudioPlayer";
import { getTadokuBooks, getTadokuDetail, getTadokuLog } from "@/lib/data";

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
  return (
    <>
      <Link href={`/ja/tadoku?level=${book.level}`} className="text-sm text-muted">
        ‹ 多読書庫
      </Link>
      <div className="mt-1 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" lang="ja">
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

      {detail?.youtube && (
        <div className="-mx-4 mb-3 aspect-video md:mx-0 md:overflow-hidden md:rounded-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${detail.youtube}?playsinline=1&rel=0`}
            title={book.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      )}
      {detail?.youtube && <p className="mb-4 text-xs text-muted">影片是書頁＋朗讀；可以開字幕、調速度（⚙️）。</p>}

      {detail?.audio && (
        <section className="mb-4">
          <h2 className="mb-1.5 text-sm font-semibold text-muted">只聽朗讀</h2>
          <AudioPlayer src={detail.audio} />
        </section>
      )}

      <section className="mb-6 space-y-2">
        {detail?.pdf.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" className="block rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            📄 {/[^/]+e-[^/]*\.pdf$/.test(u) ? "PDF（電子版）" : /[^/]+p-[^/]*\.pdf$/.test(u) ? "PDF（列印版）" : "PDF"} ↗
          </a>
        ))}
        <a href={book.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          🌐 在多読網站上看這本書 ↗
        </a>
      </section>

      <p className="mb-4 text-xs leading-relaxed text-muted">
        © NPO 多言語多読「無料の読みもの」，CC BY-NC-ND 4.0。內容與朗讀直接來自多読網站和 YouTube，未經修改。
      </p>
    </>
  );
}
