import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import Link from "next/link";
import { KANJI_CHAPTERS } from "@/lib/config";
import { getKanji, kanjiChapterCounts } from "@/lib/data";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "漢字表・Study Hub" };

export default async function KanjiTablePage({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const q = await searchParams;
  const counts = await kanjiChapterCounts();
  const chapters = KANJI_CHAPTERS.filter((c) => counts[c]);
  // 預設：最新的一章（HSJⅡ 的最後一章）
  const chapter = chapters.includes(q.ch ?? "") ? (q.ch as string) : (chapters.at(-1) ?? "");
  const list = chapter ? await getKanji([chapter]) : [];
  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 mb-3 text-[28px] leading-[34px] font-bold">漢字表</h1>

      {chapters.length === 0 ? (
        <p className="text-muted">漢字庫還沒有資料</p>
      ) : (
        <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {chapters.map((c) => (
            <Link
              key={c}
              href={`/ja/kanji?ch=${encodeURIComponent(c)}`}
              scroll={false}
              className={`flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${c === chapter ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
            >
              {c.replace("HSJ", "")}・{counts[c]}
            </Link>
          ))}
        </nav>
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
        <div className="fixed inset-x-0 bottom-20 mx-auto max-w-xl px-4 md:max-w-2xl">
          <Link
            href={`/review/words?chapters=${encodeURIComponent(chapter)}`}
            className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-on-accent shadow-lg"
          >
            練習這章（{list.length}）
          </Link>
        </div>
      )}
    </>
  );
}
