"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuizItem } from "@/lib/types";
import { StatusMessage } from "@/components/StatusMessage";

export function MistakeList({ items }: { items: QuizItem[] }) {
  const types = useMemo(() => [...new Set(items.map((i) => i.qtype ?? "其他"))].sort(), [items]);
  const [filter, setFilter] = useState<string | null>(null);
  const shown = filter ? items.filter((i) => (i.qtype ?? "其他") === filter) : items;

  if (items.length === 0) return <StatusMessage className="mt-4" title="錯題區是空的" body="答錯的題會放進來，答對一次就移出。" />;

  return (
    <>
      <Link href="/mistakes/retest" className="mb-4 block rounded-2xl bg-accent py-3 text-center font-semibold text-on-accent">
        重測錯題（{Math.min(items.length, 30)} 題）
      </Link>
      <div className="mb-3 flex flex-wrap gap-1.5 text-sm">
        <Chip on={filter === null} onClick={() => setFilter(null)}>
          全部 {items.length}
        </Chip>
        {types.map((t) => (
          <Chip key={t} on={filter === t} onClick={() => setFilter(t)}>
            {t} {items.filter((i) => (i.qtype ?? "其他") === t).length}
          </Chip>
        ))}
      </div>
      <ul className="space-y-2.5">
        {shown.map((i) => (
          <li key={i.id} className="card px-4 py-3">
            <div className="flex justify-between text-xs text-muted">
              <span>{i.qtype}</span>
              {i.lastTested && <span>{i.lastTested.slice(5).replace("-", "/")} 答錯</span>}
            </div>
            <p className="mt-1 leading-relaxed" lang="ja">
              {i.prompt}
            </p>
            {i.myAnswer && (
              <p className="mt-1.5 text-sm text-bad" lang="ja">
                ✗ {i.myAnswer}
              </p>
            )}
            <p className="mt-0.5 text-sm font-medium text-ok" lang="ja">
              ✓ {i.answer}
            </p>
            {i.explanation && (
              <details className="mt-1 text-sm text-muted">
                <summary className="cursor-pointer">解析</summary>
                <p className="mt-1 whitespace-pre-wrap">{i.explanation}</p>
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 ${on ? "bg-ink text-bg" : "border border-line text-muted"}`}>
      {children}
    </button>
  );
}
