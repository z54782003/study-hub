import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import Link from "next/link";
import { Fragment } from "react";
import { markWord, parseUsage } from "@/lib/usage";
import { getLessonVocab } from "@/lib/data";
import { LEVELS } from "@/lib/reviewSource";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";

export const dynamic = "force-dynamic";
export const metadata = { title: "單字・Study Hub" };

const STATUS_TAG: Record<string, string> = {
  忘記: "bg-due-soft text-due",
  學習中: "bg-accent-soft text-accent",
  熟悉: "bg-accent-soft text-accent",
  精通: "bg-accent text-on-accent",
};

export default async function LessonWordsPage({ searchParams }: { searchParams: Promise<{ level?: string; lesson?: string }> }) {
  const q = await searchParams;
  const level = LEVELS.find((l) => l === q.level) ?? "初中級";
  const lesson = Math.max(1, Math.min(15, Number(q.lesson) || 1));
  const words = await getLessonVocab(level, lesson);
  const practice = `/review/words?${new URLSearchParams({ level, lessons: String(lesson) })}`;
  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 text-[28px] leading-[34px] font-bold">
        {level} 第{lesson}課
      </h1>
      <p className="mt-0.5 mb-3.5 text-[13px] text-muted">{words.length} 個字・點一下展開用法和例句</p>
      {words.length === 0 ? (
        <StatusMessage title="這課在單字庫裡還沒有字" body="在 Notion 單字庫加入這課的字（填好「課次」）後，會出現在這裡。" />
      ) : (
        <ul className="mb-24 divide-y divide-line card overflow-hidden">
          {words.map((w) => {
            const usage = parseUsage(w.usage);
            return (
              <li key={w.id}>
                {/* name 相同的 details 同時只開一個 */}
                <details name="word" className="group">
                  <summary className="flex min-h-[60px] cursor-pointer list-none items-center pr-1 pl-4">
                    <span className="flex min-w-0 flex-1 items-baseline gap-2.5 py-2">
                      <span className="text-[19px] font-semibold" lang="ja">
                        {w.word}
                      </span>
                      <span className="text-[13px] text-muted" lang="ja">
                        {w.reading}
                      </span>
                      <span className="ml-auto truncate pl-2 text-sm text-ink-2">{w.meaning}</span>
                    </span>
                    <Speak text={speakableJa(w.reading, w.word)} label={`播放「${w.reading || w.word}」`} />
                  </summary>
                  <div className="space-y-2.5 px-4 pt-0.5 pb-3.5">
                    {(w.pos || w.status) && (
                      <div className="flex gap-1.5">
                        {w.pos && <span className="tag bg-card-2 text-ink-2">{w.pos}</span>}
                        {w.status && <span className={`tag ${STATUS_TAG[w.status] ?? "bg-card-2 text-ink-2"}`}>{w.status}</span>}
                      </div>
                    )}
                    {usage.length > 0 && (
                      <>
                        <div className="label">搭配與用法</div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[15px] leading-relaxed">
                          {usage.map((u) => (
                            <Fragment key={u.ja}>
                              <dt className="font-semibold" lang="ja">
                                {u.ja}
                              </dt>
                              <dd className="text-ink-2">{u.zh}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      </>
                    )}
                    {w.examples.length > 0 && <div className="label">例句</div>}
                    {w.examples.map((e, i) => (
                      <div key={i} className="flex items-start">
                        <div className="flex-1">
                          <p className="text-base leading-loose" lang="ja">
                            {markWord(e.ja, w.word).map((part, j) =>
                              part.hit ? (
                                <b key={j} className="text-accent">
                                  {part.text}
                                </b>
                              ) : (
                                <span key={j}>{part.text}</span>
                              ),
                            )}
                          </p>
                          {e.zh && <p className="text-[13px] text-ink-2">{e.zh}</p>}
                        </div>
                        <Speak text={e.ja} label={`播放例句${i + 1}`} />
                      </div>
                    ))}
                    <Link href={`/ja/words/${w.id}?${new URLSearchParams({ level, lesson: String(lesson) })}`} className="inline-block py-1 text-sm font-semibold text-accent">
                      完整單字卡 ›
                    </Link>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {words.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom)+12px)] mx-auto max-w-xl px-4 md:max-w-[760px]">
          <Link href={practice} className="btn-primary">
            練習這課（{words.length}）
          </Link>
        </div>
      )}
    </>
  );
}
