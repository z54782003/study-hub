"use client";
import { useEffect, useState } from "react";
import { WordSheet } from "@/components/player/WordSheet";
import { Icon } from "@/components/Icon";

const tokens = (text: string) => text.split(/([A-Za-z][A-Za-z'’-]*)/).filter(Boolean).map((s) => ({ word: /^[A-Za-z]/.test(s), s }));

/** 文章內文：點單字查字典、加入單字庫（例句帶入那一段） */
export function VoaText({ paragraphs }: { paragraphs: string[] }) {
  const [sheet, setSheet] = useState<{ word: string; sentence: string; at: string } | null>(null);
  return (
    <>
      <div className="read space-y-3 text-[17px] leading-[1.65]" lang="en">
        {paragraphs.map((p, i) => (
          <p key={i}>
            {tokens(p).map((t, j) =>
              t.word ? (
                <span
                  key={j}
                  onClick={() => setSheet({ word: t.s, sentence: p, at: `${i}:${j}` })}
                  className={`-mx-0.5 cursor-pointer rounded-[5px] px-0.5 ${sheet?.at === `${i}:${j}` ? "bg-accent-soft" : ""}`}
                >
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
      aria-pressed={done}
      className={`h-9 shrink-0 rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${done ? "border-ok-soft bg-ok-soft text-ok" : "border-line bg-card text-ink-2"}`}
    >
      {done ? "✓ 讀完" : "讀完了"}
    </button>
  );
}

/** 列表上的標題：讀過的變灰、右上打 ✓ */
export function VoaTitle({ id, title }: { id: string; title: string }) {
  const [read, setRead] = useState(false);
  useEffect(() => {
    try {
      setRead((JSON.parse(localStorage.getItem("voa-read") ?? "[]") as string[]).includes(id));
    } catch {}
  }, [id]);
  return (
    <span className="flex items-start gap-2">
      <span className={`read flex-1 text-[17px] leading-snug font-bold ${read ? "text-muted" : ""}`} lang="en">
        {title}
      </span>
      {read && (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ok-soft text-ok" role="img" aria-label="已讀">
          <Icon name="check" size={14} stroke={3} />
        </span>
      )}
    </span>
  );
}
