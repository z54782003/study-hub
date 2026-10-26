"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewItem } from "@/lib/types";

type Result = { item: ReviewItem; correct: boolean };
type Sync = { pending: number; failed: { item: ReviewItem; correct: boolean }[] };

const KIND_LABEL: Record<ReviewItem["kind"], string> = { quiz: "題庫", n3: "N3 單字", grammar: "文型" };

async function postAnswer(item: ReviewItem, correct: boolean) {
  const res = await fetch("/api/review/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: item.kind, id: item.id, correct }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
}

export function ReviewSession() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [sync, setSync] = useState<Sync>({ pending: 0, failed: [] });
  const [journal, setJournal] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const startedAt = useRef(Date.now());

  useEffect(() => {
    fetch("/api/review")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? r.statusText);
        setItems(data.items);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // 每答一題就寫回 Notion：中途關掉 App 也不會遺失已作答的結果
  const send = useCallback((item: ReviewItem, correct: boolean) => {
    setSync((s) => ({ ...s, pending: s.pending + 1 }));
    postAnswer(item, correct)
      .then(() => setSync((s) => ({ ...s, pending: s.pending - 1 })))
      .catch(() => setSync((s) => ({ pending: s.pending - 1, failed: [...s.failed, { item, correct }] })));
  }, []);

  const retryFailed = () => {
    const failed = sync.failed;
    setSync((s) => ({ ...s, failed: [] }));
    failed.forEach((f) => send(f.item, f.correct));
  };

  const answer = (correct: boolean) => {
    if (!items) return;
    const item = items[index];
    setResults((r) => [...r, { item, correct }]);
    send(item, correct);
    setIndex((i) => i + 1);
    setRevealed(false);
    setDraft("");
  };

  const finished = items !== null && index >= items.length;

  useEffect(() => {
    if (!finished || journal !== "idle" || results.length === 0 || sync.pending > 0) return;
    setJournal("saving");
    const minutes = Math.round((Date.now() - startedAt.current) / 60000);
    fetch("/api/journal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minutes }),
    })
      .then((r) => setJournal(r.ok ? "saved" : "error"))
      .catch(() => setJournal("error"));
  }, [finished, journal, results.length, sync.pending]);

  if (loadError) return <p className="mt-10 text-bad">讀取失敗：{loadError}</p>;
  if (!items) return <p className="mt-10 text-center text-muted">讀取到期題目中…</p>;
  if (items.length === 0)
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">🎉</div>
        <p className="mt-3 text-lg font-semibold">今天沒有到期的題目</p>
        <Link href="/" className="mt-6 inline-block text-accent">
          回今日清單
        </Link>
      </div>
    );

  const syncBar = (
    <div className="flex h-5 items-center gap-2 text-xs text-muted">
      {sync.pending > 0 && <span>同步中 {sync.pending}…</span>}
      {sync.failed.length > 0 && (
        <button type="button" onClick={retryFailed} className="text-bad underline">
          {sync.failed.length} 題沒寫進 Notion，點這裡重試
        </button>
      )}
    </div>
  );

  if (finished) {
    const right = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-bold">複習完成</h1>
        <p className="mt-2 text-4xl font-bold">
          {right}/{results.length}
          <span className="ml-2 text-lg font-normal text-muted">{Math.round((right / results.length) * 100)}%</span>
        </p>
        {syncBar}
        <p className="mt-1 text-sm text-muted">
          {journal === "saving" && "寫入 Journal…"}
          {journal === "saved" && "已勾選 Journal 的 🇯🇵 Class Review，並加上學習時數"}
          {journal === "error" && "Journal 寫入失敗（複習結果已寫回）"}
        </p>
        {wrong.length > 0 && (
          <section className="mt-6">
            <h2 className="font-semibold">答錯的 {wrong.length} 題</h2>
            <ul className="mt-2 space-y-2">
              {wrong.map(({ item }) => (
                <li key={item.id} className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
                  <span className="mr-2 text-xs text-muted">{KIND_LABEL[item.kind]}</span>
                  {item.kind === "quiz" && `${item.prompt} → ${item.answer}`}
                  {item.kind === "n3" && `${item.word}（${item.reading}）${item.meaning}`}
                  {item.kind === "grammar" && `${item.pattern}：${item.meaning}`}
                </li>
              ))}
            </ul>
          </section>
        )}
        <Link href="/" className="mt-8 block rounded-2xl bg-accent py-3 text-center font-semibold text-white">
          回今日清單
        </Link>
      </div>
    );
  }

  const item = items[index];
  return (
    <div className="mt-2 flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {KIND_LABEL[item.kind]}
          {item.kind === "quiz" && item.qtype && `・${item.qtype}`}
          {item.kind === "n3" && `・${item.source === "due" ? "到期複習" : "今日新字"}`}
        </span>
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      {syncBar}

      <article className="mt-2 flex-1 rounded-3xl border border-line bg-card p-5">
        <Front item={item} />
        {item.kind === "quiz" && !revealed && (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="先寫下你的答案（可略過）"
            rows={3}
            lang="ja"
            className="mt-4 w-full rounded-xl border border-line bg-bg p-3 text-base outline-none focus:border-accent"
          />
        )}
        {revealed && (
          <div className="mt-5 border-t border-line pt-4">
            <Back item={item} draft={draft} />
          </div>
        )}
      </article>

      <div className="sticky bottom-24 mt-4">
        {revealed ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => answer(false)} className="rounded-2xl bg-bad py-4 text-lg font-semibold text-white">
              ✗ 不會
            </button>
            <button type="button" onClick={() => answer(true)} className="rounded-2xl bg-ok py-4 text-lg font-semibold text-white">
              ✓ 會
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setRevealed(true)} className="w-full rounded-2xl bg-ink py-4 text-lg font-semibold text-bg">
            看答案
          </button>
        )}
      </div>
    </div>
  );
}

function Front({ item }: { item: ReviewItem }) {
  if (item.kind === "quiz") return <p className="text-xl leading-relaxed whitespace-pre-wrap" lang="ja">{item.prompt}</p>;
  if (item.kind === "n3")
    return (
      <p className="py-6 text-center text-5xl font-bold" lang="ja">
        {item.word}
      </p>
    );
  return (
    <p className="py-6 text-center text-3xl font-bold" lang="ja">
      {item.pattern}
    </p>
  );
}

function Back({ item, draft }: { item: ReviewItem; draft: string }) {
  if (item.kind === "quiz")
    return (
      <div className="space-y-3">
        {draft.trim() && (
          <p className="text-muted">
            你的答案：<span lang="ja">{draft}</span>
          </p>
        )}
        <p className="text-xl font-semibold text-ok" lang="ja">
          {item.answer}
        </p>
        {item.explanation && <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{item.explanation}</p>}
      </div>
    );
  if (item.kind === "n3")
    return (
      <div className="space-y-2 text-center">
        <p className="text-2xl" lang="ja">
          {item.reading}
        </p>
        <p className="text-xl font-semibold">{item.meaning}</p>
        <p className="text-sm text-muted">
          {[item.pos, item.level, item.status].filter(Boolean).join("・")}
        </p>
        {item.note && (
          <p className="text-sm whitespace-pre-wrap text-muted" lang="ja">
            {item.note}
          </p>
        )}
      </div>
    );
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">{item.meaning}</p>
      {item.connection && <p className="text-sm text-muted">接續：<span lang="ja">{item.connection}</span></p>}
      {item.confusable && <p className="text-sm text-muted">易混淆：<span lang="ja">{item.confusable}</span></p>}
    </div>
  );
}
