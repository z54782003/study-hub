"use client";
import { useEffect, useState } from "react";
import { Speak } from "@/components/Speak";
import { Icon } from "@/components/Icon";

type Entry = { phonetic?: string; audio?: string; meanings: { pos: string; def: string }[] };

// 英英定義用免費的 dictionaryapi.dev；中文意思連到 Cambridge 英漢（繁體），存進單字庫後由 Notion AI 補中文翻譯。
/** 變化形找不到時，依序試原形：gliders→glider、tried→try、making→make… */
export function baseForms(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  const add = (x: string) => x.length > 2 && !out.includes(x) && out.push(x);
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) (add(w.slice(0, -2)), add(w.slice(0, -1)));
  if (w.endsWith("ing")) (add(w.slice(0, -3)), add(w.slice(0, -3) + "e"));
  if (/(\w)\1(ed|ing)$/.test(w)) add(w.replace(/(\w)\1(ed|ing)$/, "$1"));
  return out;
}

async function lookup(word: string): Promise<Entry | null> {
  let res: Response | null = null;
  for (const w of baseForms(word)) {
    res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (res.ok) break;
  }
  if (!res?.ok) return null;
  const data = (await res.json()) as {
    phonetic?: string;
    phonetics?: { text?: string; audio?: string }[];
    meanings?: { partOfSpeech: string; definitions: { definition: string }[] }[];
  }[];
  const first = data[0];
  if (!first) return null;
  return {
    phonetic: first.phonetic ?? first.phonetics?.find((p) => p.text)?.text,
    audio: data.flatMap((d) => d.phonetics ?? []).find((p) => p.audio)?.audio,
    meanings: data
      .flatMap((d) => d.meanings ?? [])
      .slice(0, 3)
      .map((m) => ({ pos: m.partOfSpeech, def: m.definitions[0]?.definition ?? "" })),
  };
}

export function WordSheet({
  word: raw,
  sentence,
  onClose,
  docked,
}: {
  word: string;
  sentence: string;
  onClose: () => void;
  /** iPad 版：常駐在右欄，不蓋住畫面 */
  docked?: boolean;
}) {
  const word = raw.replace(/[’']s$/i, "").toLowerCase();
  const [entry, setEntry] = useState<Entry | null | "loading">("loading");
  const [saved, setSaved] = useState<"idle" | "saving" | "created" | "exists" | "error">("idle");

  useEffect(() => {
    setEntry("loading");
    setSaved("idle");
    lookup(word)
      .then(setEntry)
      .catch(() => setEntry(null));
  }, [word]);

  const save = async () => {
    setSaved("saving");
    try {
      const r = await fetch("/api/vocab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word, sentence, lang: "en" }),
      });
      const data = await r.json();
      setSaved(!r.ok ? "error" : data.created ? "created" : "exists");
    } catch {
      setSaved("error");
    }
  };

  // 下拉關閉：拖超過 80px 就關，不到就彈回
  const [drag, setDrag] = useState<{ start: number; dy: number } | null>(null);
  // 打開時鎖住背景捲動，閱讀位置不動
  useEffect(() => {
    if (docked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [docked]);
  const hit = new RegExp(`(\\b${word.replace(/[^a-z'-]/g, "")}\\w*)`, "i");

  const sheetProps = docked
    ? { "aria-label": `字典：${word}`, className: "card p-5" }
    : {
        role: "dialog",
        "aria-label": `字典：${word}`,
        className: "relative mx-auto w-full max-w-xl touch-none rounded-t-[24px] bg-card px-5 pt-2 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-sheet",
        style: { transform: drag ? `translateY(${drag.dy}px)` : undefined, transition: drag ? "none" : "transform 200ms" },
        onPointerDown: (e: React.PointerEvent) => {
          if ((e.target as HTMLElement).closest("a,button")) return;
          setDrag({ start: e.clientY, dy: 0 });
        },
        onPointerMove: (e: React.PointerEvent) => drag && setDrag({ ...drag, dy: Math.max(0, e.clientY - drag.start) }),
        onPointerUp: () => {
          if (drag && drag.dy > 80) onClose();
          setDrag(null);
        },
        onPointerCancel: () => setDrag(null),
      };

  const card = (
      <section {...sheetProps}>
        {!docked && (
          <div className="flex justify-center py-1">
            <span className="h-[5px] w-10 rounded-full bg-line" />
          </div>
        )}
        <div className="mt-1 flex items-center gap-1">
          <h2 className="read text-3xl font-bold" lang="en">
            {word}
          </h2>
          {entry && entry !== "loading" && entry.phonetic && <span className="ml-2 text-[15px] text-ink-2">{entry.phonetic}</span>}
          {entry && entry !== "loading" && entry.audio ? (
            <button type="button" onClick={() => void new Audio(entry.audio!).play()} className="grid size-11 place-items-center text-muted" aria-label={`播放 ${word}`}>
              <Icon name="speaker" stroke={2} />
            </button>
          ) : (
            <Speak text={word} lang="en" />
          )}
        </div>

        <div className="mt-3 min-h-16 space-y-1.5 text-[15px]">
          {entry === "loading" && <p className="text-muted">查詢中…</p>}
          {entry === null && <p className="text-muted">字典裡找不到（可能是變化形，試試 Cambridge）。</p>}
          {entry && entry !== "loading" &&
            entry.meanings.map((m, i) => (
              <p key={i} lang="en" className="read text-base leading-normal">
                <i className="mr-1.5 text-muted">{m.pos}</i>
                {m.def}
              </p>
            ))}
        </div>

        <p className="read mt-3 rounded-xl bg-card-2 px-3 py-2.5 text-[15px] leading-normal text-ink-2" lang="en">
          {sentence.split(hit).map((part, i) =>
            i % 2 ? (
              <b key={i} className="text-accent">
                {part}
              </b>
            ) : (
              part
            ),
          )}
        </p>

        <div className="mt-4 grid grid-cols-[1fr_1.3fr] gap-2">
          <a
            href={`https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(word)}`}
            target="_blank"
            rel="noreferrer"
            className="grid h-[52px] place-items-center rounded-[14px] border border-line text-[15px] font-semibold"
          >
            中文意思 ↗
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saved !== "idle" && saved !== "error"}
            className="h-[52px] rounded-[14px] bg-accent text-base font-bold text-on-accent disabled:opacity-70"
          >
            {saved === "idle" && "＋ 單字庫"}
            {saved === "saving" && "加入中…"}
            {saved === "created" && "✓ 已加入"}
            {saved === "exists" && "已在單字庫"}
            {saved === "error" && "失敗，再試一次"}
          </button>
        </div>
      </section>
  );
  if (docked) return card;
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button type="button" aria-label="關閉字典卡" onClick={onClose} className="absolute inset-0 bg-[rgba(10,12,18,0.32)]" />
      {card}
    </div>
  );
}
