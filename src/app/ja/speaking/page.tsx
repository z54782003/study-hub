import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";
import { getSpeaking } from "@/lib/data";
import { BOOKS, isBook, lessonNo, type Book } from "@/lib/speaking";
import { SpeakingSetCard } from "./SpeakingSetCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "口說練習・Study Hub" };

/** 網址參數：?b=初級 換課本（預設初中級），?l=3 選課 */
const href = (book: Book, l?: number) => {
  const q = new URLSearchParams();
  if (book !== "初中級") q.set("b", book);
  if (l) q.set("l", String(l));
  const s = q.toString();
  return s ? `/ja/speaking?${s}` : "/ja/speaking";
};

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ b?: string; l?: string }> }) {
  const q = await searchParams;
  const book: Book = isBook(q.b) ? q.b : "初中級";
  const data = await getSpeaking(book, q.l ? `${book} L${q.l}` : null).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 text-[28px] leading-[34px] font-bold">口說練習</h1>
      <p className="mb-3 text-sm text-muted">
        <span lang="ja">できる日本語 {book}・言ってみよう</span>：看圖先自己說，再打開答え例
      </p>
      <nav aria-label="課本" className="mb-3 flex gap-1">
        {BOOKS.map((b) => (
          <Link
            key={b}
            href={href(b)}
            scroll={false}
            aria-current={b === book ? "page" : undefined}
            className={`grid h-9 place-items-center rounded-full border px-4 text-sm font-bold ${b === book ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
          >
            {b}
          </Link>
        ))}
      </nav>

      {data instanceof Error ? (
        <StatusMessage tone="error" title="讀不到口說練習" body={`Notion 回應：${data.message}`} />
      ) : data.lessons.length === 0 ? (
        <StatusMessage title="還沒有口說練習" body={`Notion「口說練習（言ってみよう）」資料庫還沒有${book}的資料。`} />
      ) : (
        <>
          <nav aria-label="課" className="mb-4 flex flex-wrap gap-1">
            {data.lessons.map((l) => {
              const n = lessonNo(l);
              const on = l === data.lesson;
              return (
                <Link
                  key={l}
                  href={href(book, n)}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={`grid h-11 min-w-11 place-items-center rounded-xl border px-3 text-[15px] font-bold ${on ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
                >
                  L{n}
                </Link>
              );
            })}
          </nav>
          {[...new Set(data.sets.map((s) => s.st))].map((st) => (
            <section key={st} className="mb-6">
              <h2 className="mb-2 text-xl font-bold" lang="ja">
                {st}
              </h2>
              <div className="space-y-4">
                {data.sets
                  .filter((s) => s.st === st)
                  .map((s) => (
                    <SpeakingSetCard key={s.id} set={s} />
                  ))}
              </div>
            </section>
          ))}
          <p className="text-xs text-muted">
            {book === "初級"
              ? "答え例取自初級スクリプト・答え例；「※自分のことを言う」的題目沒有固定答案，用自己的情況說。"
              : "答え例取自 Script_Answer；跟這版課本對不上的題目照課本提示自編，標「自編」。"}
          </p>
        </>
      )}
    </>
  );
}
