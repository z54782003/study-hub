"use client";
import { useState } from "react";
import { DetailBody } from "@/components/DetailBody";
import type { N3Detail } from "@/lib/n3Detail";

/** 點開才讀 Notion 漢字庫該頁的「📘 詳解」（由 Notion AI 先寫好） */
export function KanjiDetail({ id, kanji }: { id: string; kanji: string }) {
  const [state, setState] = useState<{ detail?: N3Detail | null; error?: string; loading?: boolean }>({});
  const load = async () => {
    if (state.detail !== undefined || state.loading) return;
    setState({ loading: true });
    try {
      const r = await fetch(`/api/n3/detail?id=${encodeURIComponent(id)}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? r.status);
      setState({ detail: body as N3Detail | null });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <details className="group mt-2 border-t border-line pt-2" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void load()}>
      <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent">
        <span className="group-open:hidden">說明・例句 ▾</span>
        <span className="hidden group-open:inline">收起 ▴</span>
      </summary>
      <div className="space-y-4 pt-3">
        {state.detail ? (
          <DetailBody d={state.detail} mark={kanji} />
        ) : state.detail === null ? (
          <p className="text-sm text-muted">Notion 還沒有這個字的「📘 詳解」。</p>
        ) : state.error ? (
          <p className="text-sm text-bad">讀不到：{state.error}</p>
        ) : (
          <p className="text-sm text-muted">載入中…</p>
        )}
      </div>
    </details>
  );
}
