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

export function WordSheet({ word: raw, sentence, onClose }: { word: string; sentence: string; onClose: () => void }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-xl rounded-t-3xl bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-baseline gap-3">
          <h2 className="text-3xl font-bold" lang="en">
            {word}
          </h2>
          {entry && entry !== "loading" && entry.phonetic && <span className="text-muted">{entry.phonetic}</span>}
          {entry && entry !== "loading" && entry.audio ? (
            <button type="button" onClick={() => void new Audio(entry.audio!).play()} className="grid size-11 place-items-center text-muted" aria-label="發音">
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
              <p key={i} lang="en">
                <span className="mr-1.5 text-xs text-accent">{m.pos}</span>
                {m.def}
              </p>
            ))}
        </div>

        <p className="mt-3 rounded-xl bg-bg p-3 text-sm text-muted" lang="en">
          {sentence}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <a
            href={`https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(word)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-line py-3 text-center"
          >
            中文意思 ↗
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saved !== "idle" && saved !== "error"}
            className="rounded-2xl bg-accent py-3 font-semibold text-on-accent disabled:opacity-70"
          >
            {saved === "idle" && "＋ 單字庫"}
            {saved === "saving" && "加入中…"}
            {saved === "created" && "✓ 已加入"}
            {saved === "exists" && "已在單字庫"}
            {saved === "error" && "失敗，再試一次"}
          </button>
        </div>
      </div>
    </div>
  );
}
