"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import { glossParts, parseUsage } from "@/lib/usage";
import { Ruby } from "@/components/Ruby";
import type { VocabItem } from "@/lib/types";

const STATUS_TAG: Record<string, string> = {
  忘記: "bg-due-soft text-due",
  學習中: "bg-accent-soft text-accent",
  熟悉: "bg-accent-soft text-accent",
  精通: "bg-accent text-on-accent",
};

/** 「・⚠️」提醒：「相關：」那種把日文和括號裡的中文補充分開顏色，其他（多半是中文說明）照原樣 */
function Note({ text }: { text: string }) {
  const rel = text.match(/^相關[：:]\s*(.+)$/);
  if (!rel) return <>⚠️ <Ruby text={text} /></>;
  return (
    <>
      <span className="tag mr-2 bg-card-2 text-ink-2">相關</span>
      {glossParts(rel[1]).map((p, i) =>
        p.zh ? (
          <span key={i} className="text-sm text-muted">
            {p.text}
          </span>
        ) : (
          <span key={i} className="text-[15px] font-semibold text-ink" lang="ja">
            <Ruby text={p.text} />
          </span>
        ),
      )}
    </>
  );
}

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
export function LessonCards({
  groups: all,
  practice: lessonPractice,
  sectionPractice,
  lang = "ja",
}: {
  groups: { title: string; words: VocabItem[] }[];
  practice: string;
  /** 小節名稱 → 只練這一小節的網址 */
  sectionPractice: Record<string, string>;
  /** 英文單字卡也用這個元件：發音、lang 屬性、按鈕文字跟著換 */
  lang?: "ja" | "en";
}) {
  const t = lang === "en" ? { all: "練習全部", part: "練習這個主題", tabs: "主題" } : { all: "練習這課", part: "練習這段", tabs: "課本小節" };
  // 選 ST：全部／1-1／1-2／補…；課本順序攤平，每張卡記得自己在哪一段
  // 看到哪張記在網址（?sec=4-1&w=頁面id），重新整理或分享都回到同一張
  const params = useSearchParams();
  // 日文一進來先看第一段（ST1），想看整課再點「全部」（網址記成 sec=all）
  const named0 = all.filter((g) => g.title);
  const [sec, setSec] = useState<string | null>(() => {
    const q = params.get("sec");
    if (q === "all") return null;
    return all.find((g) => g.title && g.title === q)?.title ?? (lang === "ja" && named0.length > 1 ? named0[0].title : null);
  });
  const groups = sec === null ? all : all.filter((g) => g.title === sec);
  const words = groups.flatMap((g) => g.words.map((w) => ({ ...w, section: g.title })));
  const practice = sec === null ? lessonPractice : (sectionPractice[sec] ?? lessonPractice);
  const [i, setI] = useState(() => Math.max(0, words.findIndex((x) => x.id === params.get("w"))));
  const [drag, setDrag] = useState<{ x: number; dx: number } | null>(null);
  const w = words[i];
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("sec", sec ?? "all");
    url.searchParams.set("w", w.id);
    window.history.replaceState(window.history.state, "", url);
  }, [sec, w.id]);
  const go = (k: number) => setI(Math.max(0, Math.min(words.length - 1, k)));
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);
  const usage = parseUsage(w.usage);

  const pick = (t: string | null) => {
    setSec(t);
    setI(0);
  };
  const named = all.filter((g) => g.title);

  return (
    <div className="pb-24">
      {named.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t.tabs}>
          {[null, ...named.map((g) => g.title)].map((t) => {
            const on = t === sec;
            const n = t === null ? all.reduce((a, g) => a + g.words.length, 0) : all.find((g) => g.title === t)!.words.length;
            return (
              <button
                key={t ?? "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pick(t)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap ${on ? "border-accent bg-accent text-on-accent" : "border-line bg-card text-ink-2"}`}
                lang={lang}
              >
                {t === null ? "全部" : t}
                <span className="ml-1 font-normal opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            一覽（{i + 1} / {words.length}）
          </summary>
          <div className="mt-2 space-y-2.5">
            {groups.map((g) => (
              <section key={g.title}>
                {g.title && (
                  <h3 className="mb-1.5 text-xs font-bold text-muted" lang={lang}>
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
                        lang={lang}
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
          {sec === null ? t.all : t.part} ›
        </Link>
      </div>

      <article
        key={w.id}
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
            <div className="mb-1 text-xs font-bold text-muted" lang={lang}>
              {w.section}
            </div>
          )}
          <h1 className="text-[44px] leading-tight font-bold tracking-[0.02em]" lang={lang}>
            {w.word}
          </h1>
          <div className="-ml-1 flex items-center">
            <span className="pl-1 text-[17px] text-ink-2" lang={lang}>
              {w.reading}
            </span>
            <Speak text={lang === "en" ? w.word : speakableJa(w.reading, w.word)} lang={lang} label="播放讀音" />
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
            <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 pt-1.5 text-[15px] leading-loose">
              {usage.map((u, k) =>
                u.note ? (
                  <dd key={k} className="col-span-2 text-sm leading-loose text-ink-2">
                    <Note text={u.ja} />
                  </dd>
                ) : (
                <Fragment key={k}>
                  <dt className="font-semibold" lang={lang}>
                    <Ruby text={u.ja} />
                  </dt>
                  <dd className="text-ink-2">
                    <Ruby text={u.zh} />
                  </dd>
                </Fragment>
                ),
              )}
            </dl>
          </section>
        )}
        {w.examples.length > 0 && (
          <section className="space-y-2">
            <div className="label">例句</div>
            {w.examples.map((e, k) => (
              <div key={k} className="flex items-start">
                <div className="flex-1">
                  <p className="pt-1.5 text-[17px] leading-loose" lang={lang}>
                    <Ruby text={e.ja} word={w.word} />
                  </p>
                  {e.zh && <p className="text-sm text-ink-2">{e.zh}</p>}
                </div>
                <Speak text={e.ja} lang={lang} label={`播放例句${k + 1}`} />
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
            {sec === null ? t.all : t.part}
          </Link>
        )}
      </div>
    </div>
  );
}
