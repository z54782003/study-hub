"use client";
import { useState } from "react";
import type { N3WordItem } from "@/lib/types";

export function N3Cards({ words }: { words: N3WordItem[] }) {
  const [hide, setHide] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (words.length === 0) return <p className="text-muted">今天沒有新的批次（12/19 起為純複習期）。</p>;

  return (
    <>
      <label className="mb-3 flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        遮住讀音和中文（點卡片翻開）
      </label>
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {words.map((w) => {
          const shown = !hide || open.has(w.id);
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => toggle(w.id)}
                className="flex h-full min-h-24 w-full flex-col items-center justify-center rounded-2xl border border-line bg-card p-3 text-center"
              >
                <span className="text-2xl font-bold" lang="ja">{w.word}</span>
                <span className={`mt-1 text-sm ${shown ? "" : "invisible"}`} lang="ja">{w.reading}</span>
                <span className={`text-sm text-muted ${shown ? "" : "invisible"}`}>{w.meaning}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
