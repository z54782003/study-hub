"use client";
import { useState } from "react";
import { nextNoteReview } from "@/lib/noteReview";

/** 「標記已複習」：未複習 → 1回目 ✅ → 2回目 ✅✅ → 定着，寫回 Notion 的「複習」欄；按錯可以復原 */
export function NoteReview({ id, initial }: { id: string; initial: string | null }) {
  const [value, setValue] = useState(initial);
  const [prev, setPrev] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextNoteReview(value);

  const save = async (to: string, undo: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/notes/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, value: to }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setPrev(undo ? undefined : value);
      setValue(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="text-sm text-muted">
        複習：<b className="text-ink">{value ?? "未複習"}</b>
      </span>
      {prev !== undefined && (
        <button type="button" disabled={busy} onClick={() => save(prev ?? "未複習", true)} className="text-sm font-semibold text-muted underline">
          復原
        </button>
      )}
      {next ? (
        <button type="button" disabled={busy} onClick={() => save(next, false)} className="btn-primary ml-auto min-h-11 px-4 text-sm">
          {busy ? "寫入中…" : `標記已複習（→ ${next}）`}
        </button>
      ) : (
        <span className="ml-auto text-sm font-semibold text-ok">已定着</span>
      )}
      {error && <p className="w-full text-sm text-bad">寫回 Notion 失敗：{error}</p>}
    </div>
  );
}
