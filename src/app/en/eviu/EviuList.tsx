"use client";
import { useState } from "react";
import { formatJP } from "@/lib/dates";
import { EVIU_STATUSES, eviuProgress, type EviuUnit } from "@/lib/eviu";

const LABEL: Record<string, string> = { "Not started": "未開始", Studying: "Studying", Reviewing: "Reviewing", Done: "Done" };
const TONE: Record<string, string> = {
  Studying: "bg-accent-soft text-accent",
  Reviewing: "bg-due-soft text-due",
  Done: "bg-ok-soft text-ok",
};

/** 單元清單：點一列展開，改 Status 時一併填 Studied（沒填過就填今天），日期也可以自己改 */
export function EviuList({ units: initial, today }: { units: EviuUnit[]; today: string }) {
  const [units, setUnits] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const save = async (u: EviuUnit, change: { status?: string; studied?: string | null }) => {
    setBusy(u.id);
    setError(null);
    try {
      const r = await fetch("/api/eviu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: u.id, ...change }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setUnits((us) => us.map((x) => (x.id === u.id ? { ...x, ...change } : x)));
    } catch (e) {
      setError(`Unit ${u.no}：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const shown = onlyOpen ? units.filter((u) => u.status !== "Reviewing" && u.status !== "Done") : units;
  const p = eviuProgress(units);
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        完成 {p.done}／{p.total}（Reviewing＋Done）{p.studying > 0 && `・學習中 ${p.studying}`}
      </p>
      <label className="mb-2 flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="size-4" />
        只看還沒完成的
      </label>
      {error && <p className="mb-2 text-sm text-bad">寫回 Notion 失敗：{error}</p>}
      <ul className="card divide-y divide-line overflow-hidden">
        {shown.map((u) => {
          const status = u.status ?? "Not started";
          const expanded = open === u.id;
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : u.id)}
                aria-expanded={expanded}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
              >
                <span className="w-7 shrink-0 text-right text-sm font-bold text-muted tabular-nums">{u.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug font-semibold" lang="en">
                    {u.unit}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[u.theme, u.studied && `Studied ${formatJP(u.studied)}`].filter(Boolean).join("・")}
                  </span>
                </span>
                {status !== "Not started" && <span className={`tag shrink-0 ${TONE[status] ?? ""}`}>{status}</span>}
              </button>
              {expanded && (
                <div className="space-y-2.5 border-t border-line bg-card-2 px-4 py-3">
                  <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Unit ${u.no} 的 Status`}>
                    {EVIU_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy === u.id}
                        aria-pressed={status === s}
                        onClick={() => save(u, s === "Not started" ? { status: s } : { status: s, studied: u.studied ?? today })}
                        className={`h-10 rounded-[10px] border text-[13px] font-semibold ${status === s ? "border-accent bg-accent text-on-accent" : "border-line bg-card"}`}
                      >
                        {LABEL[s]}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted">Studied</span>
                    <input
                      type="date"
                      value={u.studied ?? ""}
                      disabled={busy === u.id}
                      onChange={(e) => save(u, { studied: e.target.value || null })}
                      className="h-10 rounded-[10px] border border-line bg-card px-2"
                    />
                    {u.studied !== today && (
                      <button type="button" disabled={busy === u.id} onClick={() => save(u, { studied: today })} className="font-semibold text-accent">
                        今天
                      </button>
                    )}
                    {busy === u.id && <span className="text-muted">寫入中…</span>}
                  </div>
                  <a href={u.url} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-accent">
                    在 Notion 打開單元筆記 ↗
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
