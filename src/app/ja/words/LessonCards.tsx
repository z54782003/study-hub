"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import { markWord, parseUsage } from "@/lib/usage";
import type { VocabItem } from "@/lib/types";

const LEVELS = ["未學", "忘記", "學習中", "熟悉", "精通"] as const;

/** 熟悉度點一下就存 */
function Familiarity({ w, status, onChange }: { w: VocabItem; status: string; onChange: (s: string) => void }) {
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pick = async (s: (typeof LEVELS)[number]) => {
    const before = status;
    onChange(s);
    setSave("saving");
    try {
      const r = await fetch("/api/vocab/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: w.id, status: s }) });
      if (!r.ok) throw new Error();
      setSave("saved");
    } catch {
      onChange(before);
      setSave("error");
    }
  };
  return (
    <section className="space-y-2 border-t border-line pt-3">
      <div className="label">
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
              className={`h-11 rounded-[12px] border text-sm font-bold ${
                on ? (forgot ? "border-due bg-due text-card" : "border-accent bg-accent text-on-accent") : `border-line bg-card ${forgot ? "text-due" : "text-ink-2"}`
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** できる日本語一課的單字：一張一張看（上一個／下一個、左右滑、一覽跳字） */
export function LessonCards({ words, practice }: { words: VocabItem[]; practice: string }) {
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<{ x: number; dx: number } | null>(null);
  const w = words[i];
  const go = (k: number) => setI(Math.max(0, Math.min(words.length - 1, k)));
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);
  const usage = parseUsage(w.usage);

  return (
    <div className="pb-24">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            一覽（{i + 1} / {words.length}）
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {words.map((x, k) => (
              <button
                key={x.id}
                type="button"
                onClick={() => go(k)}
                className={`rounded-full border px-3 py-1 text-sm ${k === i ? "border-accent bg-accent text-on-accent" : "border-line bg-card"}`}
                lang="ja"
              >
                {x.word}
              </button>
            ))}
          </div>
        </details>
        <Link href={practice} className="shrink-0 text-sm font-semibold text-accent">
          練習這課 ›
        </Link>
      </div>

      <article
        className="card touch-pan-y space-y-4 rounded-[22px] px-5 pt-5.5 pb-4.5"
        style={drag ? { transform: `translateX(${drag.dx}px)` } : undefined}
        onPointerDown={(e) => !(e.target as HTMLElement).closest("a,button") && setDrag({ x: e.clientX, dx: 0 })}
        onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x })}
        onPointerUp={() => {
          if (drag && drag.dx < -80) go(i + 1);
          else if (drag && drag.dx > 80) go(i - 1);
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
            {w.examples.map((e, k) => (
              <div key={k} className="flex items-start">
                <div className="flex-1">
                  <p className="text-[17px] leading-loose" lang="ja">
                    {markWord(e.ja, w.word).map((p, j) => (p.hit ? <b key={j} className="text-accent">{p.text}</b> : <span key={j}>{p.text}</span>))}
                  </p>
                  {e.zh && <p className="text-sm text-ink-2">{e.zh}</p>}
                </div>
                <Speak text={e.ja} label={`播放例句${k + 1}`} />
              </div>
            ))}
          </section>
        )}
        <Familiarity key={w.id} w={w} status={status[w.id] ?? w.status ?? "未學"} onChange={(s) => setStatus((m) => ({ ...m, [w.id]: s }))} />
      </article>

      <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom))] z-20 mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line bg-bg px-4 py-2.5 md:max-w-[760px]">
        <button type="button" disabled={i === 0} onClick={() => go(i - 1)} className="flex h-12 items-center justify-center gap-1 rounded-[14px] border border-line bg-card font-bold disabled:opacity-40">
          <Icon name="back" stroke={2.2} />
          上一個
        </button>
        <span className="text-sm text-muted tabular-nums">
          {i + 1} / {words.length}
        </span>
        {i < words.length - 1 ? (
          <button type="button" onClick={() => go(i + 1)} className="flex h-12 items-center justify-center gap-1 rounded-[14px] bg-accent font-bold text-on-accent">
            下一個
            <Icon name="chevron" stroke={2.2} />
          </button>
        ) : (
          <Link href={practice} className="flex h-12 items-center justify-center rounded-[14px] bg-accent font-bold text-on-accent">
            練習這課
          </Link>
        )}
      </div>
    </div>
  );
}
