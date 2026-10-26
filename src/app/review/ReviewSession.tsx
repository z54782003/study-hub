"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gradeChoice, parseChoices } from "@/lib/grading";
import { sourceLabel, sourceQuery } from "@/lib/reviewSource";
import type { GradeMethod, GradeResult, QuizItem, ReviewItem, ReviewSource, VocabItem } from "@/lib/types";

type Result = { item: ReviewItem; correct: boolean; answer?: string };
type Pending = { item: ReviewItem; correct: boolean; answer?: string; method?: GradeMethod; feedback?: string };
type Sync = { pending: number; failed: Pending[] };

const KIND_LABEL: Record<ReviewItem["kind"], string> = { quiz: "題庫", n3: "N3 單字", grammar: "文型", vocab: "單字" };

async function postAnswer(p: Pending) {
  const res = await fetch("/api/review/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: p.item.kind, id: p.item.id, correct: p.correct, answer: p.answer, method: p.method, feedback: p.feedback }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
}

export function ReviewSession({ source }: { source: ReviewSource }) {
  const mode = source.src;
  const query = sourceQuery(source);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [sync, setSync] = useState<Sync>({ pending: 0, failed: [] });
  const [journal, setJournal] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const startedAt = useRef(Date.now());

  useEffect(() => {
    fetch(`/api/review?${query}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? r.statusText);
        setItems(data.items);
      })
      .catch((e) => setLoadError(e.message));
  }, [query]);

  // 每答一題就寫回 Notion：中途關掉 App 也不會遺失已作答的結果
  const send = useCallback((p: Pending) => {
    setSync((s) => ({ ...s, pending: s.pending + 1 }));
    postAnswer(p)
      .then(() => setSync((s) => ({ ...s, pending: s.pending - 1 })))
      .catch(() => setSync((s) => ({ pending: s.pending - 1, failed: [...s.failed, p] })));
  }, []);

  const retryFailed = () => {
    const failed = sync.failed;
    setSync((s) => ({ ...s, failed: [] }));
    failed.forEach(send);
  };

  const next = (p: Pending) => {
    setResults((r) => [...r, { item: p.item, correct: p.correct, answer: p.answer }]);
    send(p);
    setIndex((i) => i + 1);
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
  if (!items) return <p className="mt-10 text-center text-muted">讀取題目中…</p>;
  if (items.length === 0)
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">🎉</div>
        <p className="mt-3 text-lg font-semibold">
          {mode === "mistakes" ? "錯題區是空的" : mode === "due" ? "今天沒有到期的題目" : "這個條件沒有題目"}
        </p>
        <div className="mt-6 flex justify-center gap-6">
          <Link href="/review" className="text-accent">
            回複習
          </Link>
          {mode === "due" && (
            <Link href="/mistakes" className="text-accent">
              看錯題區
            </Link>
          )}
        </div>
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
        <h1 className="text-2xl font-bold">{sourceLabel(source)}・完成</h1>
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
            <h2 className="font-semibold">答錯的 {wrong.length} 題（已放進錯題區）</h2>
            <ul className="mt-2 space-y-2">
              {wrong.map(({ item, answer }) => (
                <li key={item.id} className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
                  <span className="mr-2 text-xs text-muted">{KIND_LABEL[item.kind]}</span>
                  {item.kind === "quiz" && (
                    <>
                      <span lang="ja">{item.prompt}</span>
                      {answer && <span className="block text-bad" lang="ja">✗ {answer}</span>}
                      <span className="block text-ok" lang="ja">✓ {item.answer}</span>
                    </>
                  )}
                  {item.kind === "n3" && `${item.word}（${item.reading}）${item.meaning}`}
                  {item.kind === "grammar" && `${item.pattern}：${item.meaning}`}
                  {item.kind === "vocab" && `${item.word}（${item.reading}）${item.meaning}`}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link href="/mistakes" className="rounded-2xl border border-line py-3 text-center font-semibold">
            錯題區
          </Link>
          <Link href="/review" className="rounded-2xl bg-accent py-3 text-center font-semibold text-white">
            回複習
          </Link>
        </div>
      </div>
    );
  }

  const item = items[index];
  return (
    <div className="mt-2 flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {mode !== "due" && `${sourceLabel(source)}・`}
          {KIND_LABEL[item.kind]}
          {item.kind === "quiz" && item.qtype && `・${item.qtype}`}
          {item.kind === "n3" && `・${item.source === "due" ? "到期複習" : "今日新字"}`}
          {item.kind === "vocab" && item.lesson && `・${item.lesson}`}
        </span>
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      {syncBar}
      {item.kind === "quiz" ? <QuizCard key={item.id} item={item} onDone={next} /> : <FlipCard key={item.id} item={item} onDone={next} />}
    </div>
  );
}

// ── 題庫題：寫答案 → 自動比對／AI 批改 → 看結果（可改判）────────────────

function QuizCard({ item, onDone }: { item: QuizItem; onDone: (p: Pending) => void }) {
  const [draft, setDraft] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [override, setOverride] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const choices = parseChoices(item.prompt);
  // 哪些選項是正確的（正確答案對不到任何選項時為 null，交給伺服器／AI）
  const correctKeys = choices
    ? choices.options.every((o) => gradeChoice(o, choices.options, item.answer) !== null)
      ? choices.options.filter((o) => gradeChoice(o, choices.options, item.answer)).map((o) => o.key)
      : null
    : null;

  const pick = (key: string) => {
    const o = choices!.options.find((x) => x.key === key)!;
    setPicked(key);
    setDraft(`${o.key} ${o.text}`);
    if (correctKeys) {
      // 選擇題能直接判定就不用打 API
      setResult({ correct: correctKeys.includes(key), method: "自動比對", feedback: "", suggestion: "" });
    } else void grade(`${o.key} ${o.text}`, key);
  };

  const grade = async (answer = draft, choice?: string) => {
    setGrading(true);
    try {
      const r = await fetch("/api/review/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, answer, choice }),
      });
      setResult(r.ok ? await r.json() : { correct: null, method: "自評", feedback: "", suggestion: "", error: `批改 API 回應 ${r.status}` });
    } catch (e) {
      setResult({ correct: null, method: "自評", feedback: "", suggestion: "", error: e instanceof Error ? e.message : "網路錯誤" });
    } finally {
      setGrading(false);
    }
  };

  const giveUp = () => setResult({ correct: false, method: "自評", feedback: "", suggestion: "" });

  const finalCorrect = override ?? result?.correct ?? null;
  const finish = (correct: boolean) =>
    onDone({
      item,
      correct,
      answer: draft.trim() || undefined,
      method: override !== null ? "自評" : (result?.method ?? "自評"),
      feedback: result?.feedback || undefined,
    });

  return (
    <>
      <article className="mt-2 flex-1 rounded-3xl border border-line bg-card p-5">
        <p className="text-xl leading-relaxed whitespace-pre-wrap" lang="ja">
          {choices ? choices.stem : item.prompt}
        </p>
        {choices?.hint && <p className="mt-1 text-sm text-muted" lang="ja">（{choices.hint}）</p>}
        {choices && (
          <div className="mt-4 grid gap-2">
            {choices.options.map((o) => {
              const isCorrect = result && correctKeys?.includes(o.key);
              const isWrongPick = result && picked === o.key && !isCorrect;
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={Boolean(result) || grading}
                  onClick={() => pick(o.key)}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg ${
                    isCorrect ? "border-ok bg-ok/10" : isWrongPick ? "border-bad bg-bad/10" : picked === o.key ? "border-accent" : "border-line"
                  }`}
                  lang="ja"
                >
                  <span className="text-muted">{o.key}</span>
                  <span className="flex-1">{o.text}</span>
                  {isCorrect && <span className="text-ok">✓</span>}
                  {isWrongPick && <span className="text-bad">✗</span>}
                </button>
              );
            })}
          </div>
        )}
        {item.myAnswer && !result && (
          <p className="mt-3 text-xs text-muted" lang="ja">
            上次寫錯：{item.myAnswer}
          </p>
        )}

        {choices ? null : !result ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="寫下你的答案"
            rows={3}
            lang="ja"
            autoFocus
            className="mt-4 w-full rounded-xl border border-line bg-bg p-3 text-base outline-none focus:border-accent"
          />
        ) : null}
        {result && (
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            {finalCorrect !== null && (
              <p className={`text-lg font-bold ${finalCorrect ? "text-ok" : "text-bad"}`}>
                {finalCorrect ? "✓ 正確" : "✗ 錯誤"}
                <span className="ml-2 rounded-full bg-bg px-2 py-0.5 text-xs font-normal text-muted">
                  {override !== null ? "已改判" : result.method === "AI" ? "AI 批改" : result.method}
                </span>
              </p>
            )}
            {draft.trim() && !choices && (
              <p className="text-muted">
                你的答案：<span lang="ja">{draft}</span>
              </p>
            )}
            {result.feedback && <p className="rounded-xl bg-bg p-3 text-sm leading-relaxed">{result.feedback}</p>}
            {result.suggestion && !finalCorrect && (
              <p className="text-sm">
                改正：<span lang="ja">{result.suggestion}</span>
              </p>
            )}
            <p className="text-xl font-semibold text-ok" lang="ja">
              {item.answer}
            </p>
            {item.explanation && <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{item.explanation}</p>}
            {result.correct !== null && (
              <button type="button" onClick={() => setOverride(!(override ?? result.correct))} className="text-xs text-muted underline">
                批改有誤？改判為{(override ?? result.correct) ? "錯" : "對"}
              </button>
            )}
          </div>
        )}
      </article>

      <div className="sticky bottom-24 mt-4">
        {!result && choices ? (
          <button type="button" onClick={giveUp} className="w-full rounded-2xl border border-line py-4 font-semibold text-muted">
            {grading ? "批改中…" : "不會"}
          </button>
        ) : !result ? (
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <button type="button" onClick={giveUp} className="rounded-2xl border border-line py-4 font-semibold text-muted">
              不會
            </button>
            <button
              type="button"
              onClick={() => grade()}
              disabled={!draft.trim() || grading}
              className="rounded-2xl bg-ink py-4 text-lg font-semibold text-bg disabled:opacity-40"
            >
              {grading ? "批改中…" : "送出批改"}
            </button>
          </div>
        ) : finalCorrect === null ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => finish(false)} className="rounded-2xl bg-bad py-4 text-lg font-semibold text-white">
              ✗ 錯了
            </button>
            <button type="button" onClick={() => finish(true)} className="rounded-2xl bg-ok py-4 text-lg font-semibold text-white">
              ✓ 對了
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => finish(finalCorrect)} className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-white">
            下一題
          </button>
        )}
        {result && finalCorrect === null && (
          <p className="mt-2 text-center text-xs text-muted">
            AI 批改暫時無法使用，請自己判斷
            {result.error && <span className="mt-0.5 block break-all text-bad">原因：{result.error}</span>}
          </p>
        )}
      </div>
    </>
  );
}

// ── N3 單字／文型／單字庫：翻卡自評 ─────────────────────────

function FlipCard({ item, onDone }: { item: Exclude<ReviewItem, QuizItem>; onDone: (p: Pending) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <article className="mt-2 flex-1 rounded-3xl border border-line bg-card p-5">
        <p
          className={`py-6 text-center font-bold ${item.kind === "grammar" ? "text-3xl" : "text-5xl"}`}
          lang={item.kind === "vocab" && item.lang === "en" ? "en" : "ja"}
        >
          {item.kind === "grammar" ? item.pattern : item.word}
        </p>
        {revealed && (
          <div className="mt-2 border-t border-line pt-4">
            {item.kind === "vocab" ? (
              <VocabDetail item={item} />
            ) : item.kind === "n3" ? (
              <div className="space-y-2 text-center">
                <p className="text-2xl" lang="ja">
                  {item.reading}
                </p>
                <p className="text-xl font-semibold">{item.meaning}</p>
                <p className="text-sm text-muted">{[item.pos, item.level, item.status].filter(Boolean).join("・")}</p>
                {item.note && (
                  <p className="text-sm whitespace-pre-wrap text-muted" lang="ja">
                    {item.note}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-semibold">{item.meaning}</p>
                {item.connection && (
                  <p className="text-sm text-muted">
                    接續：<span lang="ja">{item.connection}</span>
                  </p>
                )}
                {item.confusable && (
                  <p className="text-sm text-muted">
                    易混淆：<span lang="ja">{item.confusable}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </article>
      <div className="sticky bottom-24 mt-4">
        {revealed ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onDone({ item, correct: false, method: "自評" })} className="rounded-2xl bg-bad py-4 text-lg font-semibold text-white">
              ✗ 不會
            </button>
            <button type="button" onClick={() => onDone({ item, correct: true, method: "自評" })} className="rounded-2xl bg-ok py-4 text-lg font-semibold text-white">
              ✓ 會
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setRevealed(true)} className="w-full rounded-2xl bg-ink py-4 text-lg font-semibold text-bg">
            看答案
          </button>
        )}
      </div>
    </>
  );
}

function VocabDetail({ item }: { item: VocabItem }) {
  const lang = item.lang === "en" ? "en" : "ja";
  return (
    <div className="space-y-3">
      <div className="text-center">
        {item.reading && (
          <p className="text-2xl" lang={lang}>
            {item.reading}
          </p>
        )}
        <p className="text-xl font-semibold">{item.meaning || "（中文翻譯還沒補）"}</p>
        <p className="text-sm text-muted">{[item.pos, item.lesson, item.status].filter(Boolean).join("・")}</p>
      </div>
      {item.usage && (
        <p className="rounded-xl bg-bg p-3 text-sm whitespace-pre-wrap" lang={lang}>
          <span className="mr-1 text-xs text-muted">搭配</span>
          {item.usage}
        </p>
      )}
      {item.examples.map((e, i) => (
        <div key={i} className="text-sm">
          <p lang={lang}>{e.ja}</p>
          {e.zh && <p className="text-muted">{e.zh}</p>}
        </div>
      ))}
    </div>
  );
}
