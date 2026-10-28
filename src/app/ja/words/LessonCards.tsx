"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import { markWord, parseUsage } from "@/lib/usage";
import type { VocabItem } from "@/lib/types";

const STATUS_TAG: Record<string, string> = {
  忘記: "bg-due-soft text-due",
  學習中: "bg-accent-soft text-accent",
  熟悉: "bg-accent-soft text-accent",
  精通: "bg-accent text-on-accent",
};

/** 熟悉度只看不改：「練習這課」答題時自動更新（錯→忘記；答對累計 3 次→熟悉、6 次→精通） */
function Familiarity({ w }: { w: VocabItem }) {
  const status = w.status ?? "未學";
  return (
    <section className="flex items-center gap-2 border-t border-line pt-3 text-[13px] text-muted">
      <span className={`tag ${STATUS_TAG[status] ?? "bg-card-2 text-ink-2"}`}>{status}</span>
      <span className="tabular-nums">
        答對 {w.right}・答錯 {w.wrong}
      </span>
      <span className="ml-auto">練習時自動更新</span>
    </section>
  );
}

/** できる日本語一課的單字：一張一張看（上一個／下一個、左右滑、一覽跳字）；熟悉度在練習時自動更新 */
export function LessonCards({ groups, practice }: { groups: { title: string; words: VocabItem[] }[]; practice: string }) {
  // 課本順序攤平；每張卡記得自己在哪一段
  const words = groups.flatMap((g) => g.words.map((w) => ({ ...w, section: g.title })));
  const [i, setI] = useState(0);
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
          <div className="mt-2 space-y-2.5">
            {groups.map((g) => (
              <section key={g.title}>
                {g.title && (
                  <h3 className="mb-1.5 text-xs font-bold text-muted" lang="ja">
                    {g.title}
                  </h3>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {g.words.map((x) => {
                    const k = words.findIndex((y) => y.id === x.id);
                    return (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => go(k)}
                        className={`rounded-full border px-3 py-1 text-sm ${k === i ? "border-accent bg-accent text-on-accent" : "border-line bg-card"}`}
                        lang="ja"
                      >
                        {x.word}
                      </button>
                    );
                  })}
                </div>
              </section>
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
          {w.section && (
            <div className="mb-1 text-xs font-bold text-muted" lang="ja">
              {w.section}
            </div>
          )}
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
        <Familiarity w={w} />
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
