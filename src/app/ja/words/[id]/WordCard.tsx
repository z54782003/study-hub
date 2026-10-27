"use client";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import { markWord, parseUsage } from "@/lib/usage";
import type { VocabItem } from "@/lib/types";

const LEVELS = ["未學", "忘記", "學習中", "熟悉", "精通"] as const;

/** 單字詳情卡：熟悉度點一下就存；左右滑切上一個／下一個字 */
export function WordCard({
  word: w,
  index,
  total,
  back,
  backLabel,
  source,
  prev,
  next,
}: {
  word: VocabItem;
  index: number;
  total: number;
  back: string;
  backLabel: string;
  source: string;
  prev: string | null;
  next: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(w.status ?? "未學");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number } | null>(null);
  const usage = parseUsage(w.usage);

  const pick = async (s: (typeof LEVELS)[number]) => {
    const before = status;
    setStatus(s);
    setSave("saving");
    try {
      const r = await fetch("/api/vocab/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: w.id, status: s }) });
      if (!r.ok) throw new Error();
      setSave("saved");
    } catch {
      setStatus(before);
      setSave("error");
    }
  };

  return (
    <div className="pb-36">
      <div className="flex items-center justify-between">
        <BackLink href={back}>{backLabel}</BackLink>
        <span className="text-[13px] text-muted tabular-nums">
          {index + 1} / {total}
        </span>
      </div>

      <article
        className="card mt-2 touch-pan-y space-y-4 rounded-[22px] px-5 pt-5.5 pb-4.5"
        style={drag ? { transform: `translateX(${drag.dx}px)` } : undefined}
        onPointerDown={(e) => !(e.target as HTMLElement).closest("a,button") && setDrag({ x: e.clientX, y: e.clientY, dx: 0 })}
        onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x })}
        onPointerUp={() => {
          if (drag && drag.dx < -80 && next) router.replace(next, { scroll: false });
          else if (drag && drag.dx > 80 && prev) router.replace(prev, { scroll: false });
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <div>
          <h1 className="text-[44px] leading-tight font-bold tracking-[0.02em]" lang="ja">
            {w.word}
          </h1>
          <div className="-ml-1 flex items-center">
            <span className="pl-1 text-[17px] text-ink-2" lang="ja">
              {w.reading}
            </span>
            <Speak text={speakableJa(w.reading, w.word)} label="播放讀音" />
          </div>
        </div>
        {w.pos && (
          <div className="flex gap-1.5">
            <span className="tag bg-card-2 text-ink-2">{w.pos}</span>
          </div>
        )}
        <p className="text-2xl leading-snug font-bold">{w.meaning}</p>
        {usage.length > 0 && (
          <section className="space-y-2">
            <div className="label">搭配與用法</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[15px] leading-relaxed">
              {usage.map((u) => (
                <Fragment key={u.ja}>
                  <dt className="font-semibold" lang="ja">
                    {u.ja}
                  </dt>
                  <dd className="text-ink-2">{u.zh}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        )}
        {w.examples.length > 0 && (
          <section className="space-y-2">
            <div className="label">例句</div>
            {w.examples.map((e, i) => (
              <div key={i} className="flex items-start">
                <div className="flex-1">
                  <p className="text-[17px] leading-loose" lang="ja">
                    {markWord(e.ja, w.word).map((p, j) =>
                      p.hit ? (
                        <b key={j} className="text-accent">
                          {p.text}
                        </b>
                      ) : (
                        <span key={j}>{p.text}</span>
                      ),
                    )}
                  </p>
                  {e.zh && <p className="text-sm text-ink-2">{e.zh}</p>}
                </div>
                <Speak text={e.ja} label={`播放例句${i + 1}`} />
              </div>
            ))}
          </section>
        )}
        <div className="border-t border-line pt-3 text-xs text-muted">
          來源：<span lang="ja">{source}</span>
        </div>
      </article>
      {(prev || next) && <p className="mt-2 text-center text-xs text-muted">左右滑切換上一個／下一個字</p>}

      <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom))] mx-auto max-w-xl space-y-2 border-t border-line bg-bg px-4 pt-2.5 pb-3 md:max-w-[760px]">
        <div className="label text-center">
          熟悉度（點一下就存）
          {save === "saving" && "・儲存中…"}
          {save === "saved" && "・已存"}
          {save === "error" && <span className="text-bad">・沒存成功，再點一次</span>}
        </div>
        <div role="radiogroup" aria-label="熟悉度" className="grid grid-cols-5 gap-1.5">
          {LEVELS.map((l) => {
            const on = l === status;
            const forgot = l === "忘記";
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && void pick(l)}
                className={`h-[52px] rounded-[14px] border text-sm font-bold ${
                  on ? (forgot ? "border-due bg-due text-card" : "border-accent bg-accent text-on-accent") : `border-line bg-card ${forgot ? "text-due" : "text-ink-2"}`
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
