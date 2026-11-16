import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { getN3Batch, today } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import { N3_BATCH_SIZE } from "@/lib/config";
import { n3WordsStart, stageFor } from "@/lib/stages";
import { N3Study } from "./N3Study";

export const dynamic = "force-dynamic";
export const metadata = { title: "N3 單字・Study Hub" };

const fmt = (n: number) => n.toLocaleString("en-US");

/** 今天的 N3 新字；?next=1 預覽下一批（還沒開始出新字時就是第一批） */
export default async function N3Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next === "1";
  const day = today();
  const stage = stageFor(day);
  const { active, words, grammar, progress } = await getN3Batch(next);
  const preview = next || !active;

  return (
    <>
      <BackLink href={next ? "/n3" : "/"}>{next ? "今天的批次" : "今天"}</BackLink>
      <h1 className="mt-1 mb-1 text-[28px] leading-[34px] font-bold">{preview ? (active ? "N3 單字・下一批" : "N3 單字・第一批") : `N3 單字 ${formatJP(day)}`}</h1>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm text-muted">
        <span>
          已學 {fmt(progress.learned)}／{fmt(progress.total)}・剩 {fmt(progress.left)} 個
          {progress.left > 0 && `（每天 ${N3_BATCH_SIZE} 個約 ${progress.days} 天）`}
        </span>
        {active && !next && progress.left > words.length && (
          <Link href="/n3?next=1" className="shrink-0 font-semibold text-accent">
            看下一批 ›
          </Link>
        )}
      </div>
      {!active && (
        <p className="mb-3 rounded-[14px] bg-card-2 px-3.5 py-2.5 text-sm text-ink-2">
          {stage.name}不出新的 N3 單字（{n3WordsStart(day)}，每天 {N3_BATCH_SIZE} 個）。下面是第一批的預覽。
        </p>
      )}
      {next && <p className="mb-3 text-sm text-muted">預覽而已：明天實際的批次是到時還沒考過的字，今天沒考完的會排在前面。</p>}
      {words.length + grammar.length > 0 ? (
        <N3Study key={next ? "next" : day} cards={[...grammar, ...words]} />
      ) : (
        <p className="text-muted">N3／N2+ 的字都學過了。</p>
      )}
    </>
  );
}
