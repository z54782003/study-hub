"use client";
import { useState } from "react";
import { Speak } from "@/components/Speak";
import { splitLine, type SpeakingSet } from "@/lib/speaking";

/** 一個題組：課本那一題的圖，下面①②③…先自己說，再點開答え例 */
export function SpeakingSetCard({ set }: { set: SpeakingSet }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === set.items.length && set.items.length > 0;
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <article className="card overflow-hidden">
      <header className="flex items-baseline gap-2 px-4 pt-3 pb-2">
        <h3 className="text-lg font-bold" lang="ja">
          ［{set.no}］
        </h3>
        {set.page !== null && <span className="text-sm text-muted">p.{set.page}</span>}
        {set.items.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(all ? new Set() : new Set(set.items.map((_, i) => i)))}
            className="ml-auto text-sm font-semibold text-accent"
          >
            {all ? "全部收起" : "全部打開"}
          </button>
        )}
      </header>

      {set.image ? (
        <a href={set.image.url} target="_blank" rel="noreferrer" className="block border-y border-line bg-white" aria-label={`開啟［${set.no}］的課本圖`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Notion 簽章網址，不走 next/image */}
          <img src={set.image.url} alt={`言ってみよう［${set.no}］課本頁`} className="block h-auto w-full" loading="lazy" />
        </a>
      ) : (
        <p className="border-y border-line px-4 py-3 text-sm text-muted">還沒有課本圖</p>
      )}

      <ol className="divide-y divide-line">
        {set.items.map((it, i) => {
          const shown = open.has(i);
          const speech = it.lines.map((l) => splitLine(l).text).join("");
          return (
            <li key={i} className="px-4 py-2.5">
              <button type="button" onClick={() => toggle(i)} aria-expanded={shown} className="flex w-full items-center gap-2 text-left">
                <span className="text-lg font-bold" lang="ja">
                  {it.label}
                </span>
                {it.own && <span className="tag bg-card-2 text-ink-2">自編</span>}
                <span className="ml-auto text-sm font-semibold text-accent">{shown ? "收起" : "看答え例"}</span>
              </button>
              {shown && (
                <div className="mt-1.5 flex items-start gap-1">
                  <div className="min-w-0 flex-1 space-y-1 text-[15px] leading-relaxed" lang="ja">
                    {it.lines.map((l, j) => {
                      const s = splitLine(l);
                      return (
                        <p key={j} className="grid grid-cols-[auto_1fr] gap-x-2">
                          <span className={`min-w-[1.6em] text-[13px] font-bold ${s.alt ? "text-muted" : "text-accent"}`}>
                            {s.alt ? `或 ${s.speaker}` : s.speaker}
                          </span>
                          <span>{s.text}</span>
                        </p>
                      );
                    })}
                  </div>
                  <Speak text={speech} label={`播放${it.label}的答え例`} className="-my-1" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {set.note && <p className="border-t border-line px-4 py-2 text-xs text-muted">{set.note}</p>}
    </article>
  );
}
