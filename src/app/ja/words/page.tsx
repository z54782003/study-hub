import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import Link from "next/link";
import { getLessonVocab } from "@/lib/data";
import { LEVELS } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "單字・Study Hub" };

export default async function LessonWordsPage({ searchParams }: { searchParams: Promise<{ level?: string; lesson?: string }> }) {
  const q = await searchParams;
  const level = LEVELS.find((l) => l === q.level) ?? "初中級";
  const lesson = Math.max(1, Math.min(15, Number(q.lesson) || 1));
  const words = await getLessonVocab(level, lesson);
  const practice = `/review/words?${new URLSearchParams({ level, lessons: String(lesson) })}`;
  return (
    <>
      <Link href="/ja" className="text-sm text-muted">
        ‹ 日文
      </Link>
      <h1 className="mt-1 text-2xl font-bold">
        {level} 第{lesson}課
      </h1>
      <p className="mb-4 text-sm text-muted">{words.length} 個字・點一下展開用法和例句</p>
      {words.length === 0 ? (
        <p className="text-muted">這課在單字庫裡還沒有字（「課次」欄還沒補）</p>
      ) : (
        <ul className="mb-24 divide-y divide-line rounded-2xl border border-line bg-card">
          {words.map((w) => (
            <li key={w.id}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-baseline gap-3">
                  <span className="text-lg font-semibold" lang="ja">
                    {w.word}
                  </span>
                  <span className="text-sm text-muted" lang="ja">
                    {w.reading}
                  </span>
                  <Speak text={speakableJa(w.reading, w.word)} className="self-center" />
                  <span className="min-w-0 flex-1 truncate text-right text-sm">{w.meaning}</span>
                </summary>
                <div className="mt-2 space-y-2 text-sm">
                  <p className="text-xs text-muted">{[w.pos, w.status].filter(Boolean).join("・")}</p>
                  {w.usage && (
                    <p className="rounded-xl bg-bg p-2.5 whitespace-pre-wrap" lang="ja">
                      <span className="mr-1 text-xs text-muted">搭配</span>
                      {w.usage}
                    </p>
                  )}
                  {w.examples.map((e, i) => (
                    <div key={i}>
                      <p className="flex items-start gap-1" lang="ja">
                        <span className="flex-1">{e.ja}</span>
                        <Speak text={e.ja} label="念例句" />
                      </p>
                      {e.zh && <p className="text-muted">{e.zh}</p>}
                    </div>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {words.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 mx-auto max-w-xl px-4 md:max-w-2xl">
          <Link href={practice} className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-white shadow-lg">
            練習這課（{words.length}）
          </Link>
        </div>
      )}
    </>
  );
}
