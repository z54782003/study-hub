"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import { markWord } from "@/lib/usage";
import type { N3Detail } from "@/lib/n3Detail";
import type { GrammarItem, N3WordItem } from "@/lib/types";

type Card = N3WordItem | GrammarItem;
type Loaded = { detail?: N3Detail; error?: string };

/** 例句：單字／文型標粗；讀音（平假名）小字；中文 */
function Examples({ list, mark }: { list: N3Detail["examples"]; mark: string }) {
  return (
    <section className="space-y-3">
      <div className="label">例句</div>
      {list.map((e, i) => (
        <div key={i} className="flex items-start">
          <div className="flex-1 space-y-0.5">
            <p className="text-[17px] leading-relaxed" lang="ja">
              {markWord(e.ja, mark).map((p, j) => (p.hit ? <b key={j} className="text-accent">{p.text}</b> : <span key={j}>{p.text}</span>))}
            </p>
            {e.kana && <p className="text-[13px] text-muted" lang="ja">{e.kana}</p>}
            {e.zh && <p className="text-sm text-ink-2">{e.zh}</p>}
          </div>
          <Speak text={e.ja} label={`播放例句${i + 1}`} />
        </div>
      ))}
    </section>
  );
}

function DetailView({ card, loaded }: { card: Card; loaded: Loaded | undefined }) {
  if (!loaded) return <p className="text-sm text-muted">詳解載入中…（第一次看要等 AI 寫，約 5–10 秒）</p>;
  if (loaded.error) return <p className="text-sm text-bad">詳解讀不到：{loaded.error}</p>;
  const d = loaded.detail!;
  const mark = card.kind === "n3" ? card.word : card.pattern.replace(/^〜/, "").split(/[／（(]/)[0];
  return (
    <>
      {d.usage && (
        <section className="space-y-1.5">
          <div className="label">用法</div>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{d.usage}</p>
        </section>
      )}
      {d.forms.length > 0 && (
        <section className="space-y-1.5">
          <div className="label">接續</div>
          <ul className="space-y-1 text-[15px]" lang="ja">
            {d.forms.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </section>
      )}
      {d.collocations.length > 0 && (
        <section className="space-y-1.5">
          <div className="label">常用搭配</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[15px] leading-relaxed">
            {d.collocations.map((c) => (
              <div key={c.ja} className="contents">
                <dt className="font-semibold" lang="ja">{c.ja}</dt>
                <dd className="text-ink-2">{c.zh}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {d.examples.length > 0 && <Examples list={d.examples} mark={mark} />}
      {d.compare && (
        <section className="space-y-1.5">
          <div className="label">比較</div>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{d.compare}</p>
        </section>
      )}
    </>
  );
}

function Head({ card }: { card: Card }) {
  if (card.kind === "grammar")
    return (
      <div className="space-y-2">
        <span className="tag bg-accent-soft text-accent">今日文型</span>
        <h1 className="text-[34px] leading-tight font-bold" lang="ja">{card.pattern}</h1>
        <p className="text-xl leading-snug font-bold">{card.meaning}</p>
        {card.connection && <p className="text-sm text-ink-2">接續：<span lang="ja">{card.connection}</span></p>}
        {card.confusable && <p className="text-sm text-ink-2">易混淆：<span lang="ja">{card.confusable}</span></p>}
      </div>
    );
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-[44px] leading-tight font-bold tracking-[0.02em]" lang="ja">{card.word}</h1>
        <div className="-ml-1 flex items-center">
          <span className="pl-1 text-[17px] text-ink-2" lang="ja">{card.reading}</span>
          <Speak text={speakableJa(card.reading, card.word)} label="播放讀音" />
        </div>
      </div>
      <div className="flex gap-1.5">
        {card.pos && <span className="tag bg-card-2 text-ink-2">{card.pos}</span>}
        {card.level && <span className="tag bg-card-2 text-ink-2">{card.level}</span>}
      </div>
      <p className="text-2xl leading-snug font-bold">{card.meaning}</p>
      {card.note && <p className="text-sm text-ink-2" lang="ja">{card.note}</p>}
    </div>
  );
}

/** 一張一張看：上一個／下一個（也可以左右滑），詳解看到哪張才去讀（順便先讀後面兩張） */
export function N3Study({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const asked = useRef(new Set<string>());
  const [drag, setDrag] = useState<{ x: number; dx: number } | null>(null);
  const card = cards[i];

  useEffect(() => {
    for (const c of cards.slice(i, i + 3)) {
      if (asked.current.has(c.id)) continue;
      asked.current.add(c.id);
      fetch(`/api/n3/detail?id=${encodeURIComponent(c.id)}`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error ?? r.status);
          return { detail: body as N3Detail };
        })
        .catch((e: Error) => {
          asked.current.delete(c.id); // 下次切回來再試
          return { error: e.message };
        })
        .then((v) => setLoaded((m) => ({ ...m, [c.id]: v })));
    }
  }, [cards, i]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);

  if (!card) return null;
  const go = (k: number) => setI(Math.max(0, Math.min(cards.length - 1, k)));

  return (
    <div className="pb-24">
      <details className="mb-2">
        <summary className="cursor-pointer text-sm font-semibold text-accent">
          一覽（{i + 1} / {cards.length}）
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cards.map((c, k) => (
            <button
              key={c.id}
              type="button"
              onClick={() => go(k)}
              className={`rounded-full border px-3 py-1 text-sm ${k === i ? "border-accent bg-accent text-on-accent" : "border-line bg-card"}`}
              lang="ja"
            >
              {c.kind === "n3" ? c.word : c.pattern}
            </button>
          ))}
        </div>
      </details>

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
        <Head card={card} />
        <div className="space-y-4 border-t border-line pt-4">
          <DetailView card={card} loaded={loaded[card.id]} />
        </div>
      </article>

      <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom))] z-20 mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line bg-bg px-4 py-2.5 md:max-w-[760px]">
        <button type="button" disabled={i === 0} onClick={() => go(i - 1)} className="flex h-12 items-center justify-center gap-1 rounded-[14px] border border-line bg-card font-bold disabled:opacity-40">
          <Icon name="back" stroke={2.2} />
          上一個
        </button>
        <span className="text-sm text-muted tabular-nums">
          {i + 1} / {cards.length}
        </span>
        {i < cards.length - 1 ? (
          <button type="button" onClick={() => go(i + 1)} className="flex h-12 items-center justify-center gap-1 rounded-[14px] bg-accent font-bold text-on-accent">
            下一個
            <Icon name="chevron" stroke={2.2} />
          </button>
        ) : (
          <button type="button" onClick={() => router.push("/")} className="h-12 rounded-[14px] bg-accent font-bold text-on-accent">
            看完了
          </button>
        )}
      </div>
    </div>
  );
}
