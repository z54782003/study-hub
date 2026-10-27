import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import Link from "next/link";
import { KANJI_CHAPTERS } from "@/lib/config";
import { getKanji, kanjiChapterCounts } from "@/lib/data";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";

export const dynamic = "force-dynamic";
export const metadata = { title: "漢字表・Study Hub" };

export default async function KanjiTablePage({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const q = await searchParams;
  const counts = await kanjiChapterCounts();
  const chapters = KANJI_CHAPTERS.filter((c) => counts[c]);
  // 預設：最新的一章（HSJⅡ 的最後一章）
  const chapter = chapters.includes(q.ch ?? "") ? (q.ch as string) : (chapters.at(-1) ?? "");
  const list = chapter ? await getKanji([chapter]) : [];
  const books = [...new Set(chapters.map((c) => c.split(" ")[0]))];
  const book = chapter.split(" ")[0];
  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 mb-3 text-[28px] leading-[34px] font-bold">漢字表</h1>

      {chapters.length === 0 ? (
        <StatusMessage title="漢字庫還沒有資料" body="在 Notion 漢字庫加入章節後，會出現在這裡。" />
      ) : (
        <div className="mb-4 space-y-2.5">
          {/* 先選冊，再選章（章只顯示數字，字數放在下面的標題） */}
          <nav aria-label="冊" className="grid grid-cols-2 gap-1 rounded-[14px] bg-card-2 p-1">
            {books.map((b) => (
              <Link
                key={b}
                href={`/ja/kanji?ch=${encodeURIComponent(b === book ? chapter : chapters.filter((c) => c.startsWith(b)).at(-1)!)}`}
                scroll={false}
                aria-current={b === book ? "page" : undefined}
                className={`flex h-10 items-center justify-center rounded-[10px] text-sm ${b === book ? "bg-card font-bold text-ink shadow-card" : "font-semibold text-ink-2"}`}
              >
                {b}
              </Link>
            ))}
          </nav>
          <nav aria-label="章" className="flex flex-wrap gap-1.5">
            {chapters
              .filter((c) => c.startsWith(book))
              .map((c) => (
                <Link
                  key={c}
                  href={`/ja/kanji?ch=${encodeURIComponent(c)}`}
                  scroll={false}
                  aria-label={`${c}・${counts[c]} 字`}
                  aria-current={c === chapter ? "page" : undefined}
                  className={`grid size-10 place-items-center rounded-xl border text-[15px] font-bold tabular-nums ${c === chapter ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
                >
                  {c.match(/(\d+)章/)?.[1]}
                </Link>
              ))}
          </nav>
          <p className="text-sm text-muted">
            <b className="text-ink">{chapter.replace(" ", " 第")}</b>・{counts[chapter]} 字
          </p>
        </div>
      )}

      <ul className="mb-24 grid gap-2.5 md:grid-cols-2">
        {list.map((k) => (
          <li key={k.id} className="card p-3" lang="ja">
            <div className="flex gap-3">
              <span className="text-4xl leading-none font-bold">{k.kanji}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div>
                  <span className="mr-1 text-xs text-muted">音</span>
                  {k.on || "—"}
                </div>
                <div>
                  <span className="mr-1 text-xs text-muted">訓</span>
                  {k.kun || "—"}
                </div>
                <div lang="zh-Hant">{k.meaning}</div>
              </div>
              {k.status && <span className="h-fit shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs text-muted">{k.status}</span>}
            </div>
            {k.examples.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-sm">
                {k.examples.map((e, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="font-medium">{e.word}</span>
                    <span className="text-muted">{e.reading}</span>
                    <Speak text={speakableJa(e.reading, e.word)} />
                    <span className="ml-auto text-right" lang="zh-Hant">
                      {e.zh}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(k.hint || k.confusable) && (
              <p className="mt-1.5 text-xs text-muted" lang="zh-Hant">
                {[k.hint, k.confusable && `易混淆：${k.confusable}`].filter(Boolean).join("　")}
              </p>
            )}
          </li>
        ))}
      </ul>

      {chapter && (
        <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom)+12px)] mx-auto max-w-xl px-4 md:max-w-[760px]">
          <Link
            href={`/review/words?chapters=${encodeURIComponent(chapter)}`}
            className="btn-primary"
          >
            練習這章（{list.length}）
          </Link>
        </div>
      )}
    </>
  );
}
