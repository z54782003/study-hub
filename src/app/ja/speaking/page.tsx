import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";
import { getSpeaking } from "@/lib/data";
import { lessonNo } from "@/lib/speaking";
import { SpeakingSetCard } from "./SpeakingSetCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "口說練習・Study Hub" };

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const q = await searchParams;
  const data = await getSpeaking(q.l ? `初中級 L${q.l}` : null).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 text-[28px] leading-[34px] font-bold">口說練習</h1>
      <p className="mb-3 text-sm text-muted">
        <span lang="ja">できる日本語 初中級・言ってみよう</span>：看圖先自己說，再打開答え例
      </p>

      {data instanceof Error ? (
        <StatusMessage tone="error" title="讀不到口說練習" body={`Notion 回應：${data.message}`} />
      ) : data.lessons.length === 0 ? (
        <StatusMessage title="還沒有口說練習" body="Notion「口說練習（言ってみよう）」資料庫還沒有資料。" />
      ) : (
        <>
          <nav aria-label="課" className="mb-4 flex flex-wrap gap-1">
            {data.lessons.map((l) => {
              const n = lessonNo(l);
              const on = l === data.lesson;
              return (
                <Link
                  key={l}
                  href={`/ja/speaking?l=${n}`}
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
          <p className="text-xs text-muted">答え例取自 Script_Answer；跟這版課本對不上的題目照課本提示自編，標「自編」。</p>
        </>
      )}
    </>
  );
}
