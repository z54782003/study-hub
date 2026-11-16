"use client";
import { useState } from "react";
import { tedFinished } from "@/lib/tedLog";

/** TED 做完／取消：寫回 Notion TED Log 的「進度」（完成）和「完成日」 */
export function useTedDone(id: string, initial: string | null) {
  const [progress, setProgress] = useState(initial);
  // 取消時改回原本的（待做／今天做）
  const [prev] = useState(tedFinished(initial) ? null : initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = tedFinished(progress);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/ted/done", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, done: !done, prev }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setProgress(body.progress ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { progress, done, busy, error, toggle };
}
