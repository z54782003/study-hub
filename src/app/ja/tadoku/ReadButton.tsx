"use client";
import { useState } from "react";

/** 「讀完了」開關：寫進 Notion 的 📚 多読紀錄 */
export function ReadButton({ id, initial }: { id: string; initial: boolean }) {
  const [read, setRead] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tadoku", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      setRead(data.read);
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded-full border px-3 py-1.5 text-sm ${read ? "border-ok bg-ok/10 text-ok" : "border-line"} disabled:opacity-50`}
      >
        {busy ? "…" : read ? "✓ 讀完" : "讀完了"}
      </button>
      {error && <p className="mt-1 max-w-28 text-xs text-bad">{error}</p>}
    </div>
  );
}
