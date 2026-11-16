import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { pendingClassNotes } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import { LEVELS } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "還沒複習的課堂筆記・Study Hub" };

/** 「複習」還是未複習的課堂筆記，從最舊的開始（預設初中級；?level=初級 看初級） */
export default async function PendingNotesPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const q = (await searchParams).level;
  const level = LEVELS.find((l) => l === q) ?? "初中級";
  const notes = await pendingClassNotes(level);
  return (
    <>
      <BackLink href="/">今天</BackLink>
      <h1 className="mt-1 mb-1 text-[28px] leading-[34px] font-bold">還沒複習的課堂筆記</h1>
      <p className="mb-3 text-sm text-muted">
        {level}・{notes.length} 篇・從最舊的開始。進去看完按「標記已複習」就會從這裡移除。
      </p>
      {notes.length === 0 ? (
        <p className="text-muted">{level}的課堂筆記都複習過了。</p>
      ) : (
        <ul className="divide-y divide-line card">
          {notes.map((n, i) => (
            <li key={`${n.id}-${i}`}>
              <Link href={`/ja/notes/${n.id}`} className="flex items-baseline gap-3 px-4 py-3">
                <span className="w-24 shrink-0 text-xs text-muted">{n.date ? formatJP(n.date) : ""}</span>
                <span className="min-w-0 flex-1 text-sm leading-snug" lang="ja">
                  {n.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{n.lesson}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
