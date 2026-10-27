import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { getN3Batch, today } from "@/lib/data";
import { addDays, diffDays, formatJP } from "@/lib/dates";
import { N3_START } from "@/lib/config";
import { n3BatchRange } from "@/lib/srs";
import { N3Study } from "./N3Study";

export const dynamic = "force-dynamic";
export const metadata = { title: "N3 單字・Study Hub" };

export default async function N3Page({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const now = today();
  const q = (await searchParams).day;
  // 可以回頭看前幾天的批次（不能看未來的）
  const day = q && /^\d{4}-\d{2}-\d{2}$/.test(q) && q >= N3_START && q <= now ? q : now;
  const { words, grammar } = await getN3Batch(day);
  const range = n3BatchRange(day);
  const prev = day > N3_START ? addDays(day, -1) : null;
  const next = day < now ? addDays(day, 1) : null;
  const dayLink = (d: string) => (d === now ? "/n3" : `/n3?day=${d}`);

  return (
    <>
      <BackLink href="/">今天</BackLink>
      <h1 className="mt-1 mb-1 text-[28px] leading-[34px] font-bold">N3 單字 {formatJP(day)}</h1>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm text-muted">
        <span>
          {range ? `第 ${diffDays(N3_START, day) + 1} 天・${words.length} 個` : "今天沒有新的批次"}
        </span>
        <span className="flex shrink-0 gap-3">
          {prev && <Link href={dayLink(prev)} className="font-semibold text-accent">‹ 前一天</Link>}
          {next && <Link href={dayLink(next)} className="font-semibold text-accent">後一天 ›</Link>}
        </span>
      </div>
      {words.length + grammar.length > 0 ? (
        <N3Study key={day} cards={[...grammar, ...words]} />
      ) : (
        <p className="text-muted">N3 單字 12/31 前全部背完（每天 40 個）；之後是純複習期。</p>
      )}
    </>
  );
}
