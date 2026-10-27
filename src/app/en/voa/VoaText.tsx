"use client";
import { useEffect, useState } from "react";
import { WordSheet } from "@/components/player/WordSheet";

const tokens = (text: string) => text.split(/([A-Za-z][A-Za-z'’-]*)/).filter(Boolean).map((s) => ({ word: /^[A-Za-z]/.test(s), s }));

/** 文章內文：點單字查字典、加入單字庫（例句帶入那一段） */
export function VoaText({ paragraphs }: { paragraphs: string[] }) {
  const [sheet, setSheet] = useState<{ word: string; sentence: string } | null>(null);
  return (
    <>
      <div className="space-y-4 text-[17px] leading-relaxed" lang="en">
        {paragraphs.map((p, i) => (
          <p key={i}>
            {tokens(p).map((t, j) =>
              t.word ? (
                <span key={j} onClick={() => setSheet({ word: t.s, sentence: p })} className="cursor-pointer rounded active:bg-accent-soft">
                  {t.s}
                </span>
              ) : (
                <span key={j}>{t.s}</span>
              ),
            )}
          </p>
        ))}
      </div>
      {sheet && <WordSheet word={sheet.word} sentence={sheet.sentence} onClose={() => setSheet(null)} />}
    </>
  );
}

/** 讀完的文章記在這支手機（localStorage） */
export function VoaDone({ id }: { id: string }) {
  const key = "voa-read";
  const read = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  };
  const [done, setDone] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDone(read().includes(id)), [id]);
  const toggle = () => {
    const ids = read().filter((x) => x !== id);
    if (!done) ids.push(id);
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {}
    setDone(!done);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${done ? "border-ok bg-ok-soft text-ok" : "border-line"}`}
     
    >
      {done ? "✓ 讀完" : "讀完了"}
    </button>
  );
}

/** 列表上的「已讀」記號 */
export function VoaReadMark({ id }: { id: string }) {
  const [read, setRead] = useState(false);
  useEffect(() => {
    try {
      setRead((JSON.parse(localStorage.getItem("voa-read") ?? "[]") as string[]).includes(id));
    } catch {}
  }, [id]);
  return read ? (
    <span className="text-ok">
      ✓
    </span>
  ) : null;
}
