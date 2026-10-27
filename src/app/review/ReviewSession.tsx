"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gradeChoice, parseChoices } from "@/lib/grading";
import { sourceLabel, sourceQuery } from "@/lib/reviewSource";
import { Speak } from "@/components/Speak";
import { speakableJa } from "@/lib/speech";
import { FORM_LABEL, FORM_RULE, GROUP_OF, checkConjugation, specialNote, type VerbForm } from "@/lib/conjugate";
import type { GradeMethod, GradeResult, KanjiItem, QuizItem, ReviewItem, ReviewSource, VerbItem, VocabItem } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { charDiff } from "@/lib/diff";
import { StatusMessage } from "@/components/StatusMessage";

type Result = { item: ReviewItem; correct: boolean; answer?: string };
type Pending = { item: ReviewItem; correct: boolean; answer?: string; method?: GradeMethod; feedback?: string };
type Sync = { pending: number; failed: Pending[] };

const KIND_LABEL: Record<ReviewItem["kind"], string> = { quiz: "題庫", n3: "N3 單字", grammar: "文型", vocab: "單字", verb: "動詞の形", kanji: "漢字" };

/** 動詞題的題目與正確答案（寫進作答紀錄用） */
const verbPrompt = (v: VerbItem) =>
  v.mode === "group" ? `${v.dict}（${v.reading}）是第幾類？` : `${v.dict}（${v.reading}）→ ${FORM_LABEL[v.form as VerbForm] ?? v.form}`;
const verbAnswer = (v: VerbItem) =>
  v.mode === "group" ? GROUP_OF[v.cls] : v.answer.word === v.answer.reading ? v.answer.word : `${v.answer.word}（${v.answer.reading}）`;

async function postAnswer(p: Pending) {
  const res = await fetch("/api/review/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: p.item.kind,
      id: p.item.id,
      correct: p.correct,
      answer: p.answer,
      method: p.method,
      feedback: p.feedback,
      ...(p.item.kind === "verb" ? { prompt: verbPrompt(p.item), reference: verbAnswer(p.item) } : {}),
    }),
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

  if (loadError) return <StatusMessage tone="error" className="mt-6" title="題目讀取失敗" body={`回複習再試一次。（原因：${loadError}）`} action={{ label: "回複習", href: "/review" }} />;
  if (!items) return <p className="mt-10 text-center text-muted">讀取題目中…</p>;
  if (items.length === 0)
    return (
      <div className="mt-16 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
          <Icon name="check" size={32} stroke={2.6} />
        </div>
        <p className="mt-3 text-lg font-semibold">
          {mode === "mistakes" ? "錯題區是空的" : mode === "due" ? "今天沒有到期的題目" : "這個條件沒有題目"}
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {mode === "mistakes"
            ? "答錯的題會放進來，答對一次就移出。"
            : mode === "due"
              ? "可以到「題目練習」挑一課，或看錯題區。"
              : "換個課次或題型，或把範圍改成「全部」。"}
        </p>
        <Link href={mode === "due" ? "/review/questions" : "/review"} className="mx-auto mt-5 flex h-12 max-w-60 items-center justify-center rounded-[14px] border border-line bg-card text-[15px] font-semibold">
          {mode === "due" ? "題目練習" : "回複習"}
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
        <h1 className="text-[28px] leading-[34px] font-bold">{sourceLabel(source)}・完成</h1>
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
                  {item.kind === "kanji" && `${item.kanji}　${[item.on, item.kun].filter(Boolean).join("／")}　${item.meaning}`}
                  {item.kind === "verb" && (
                    <>
                      <span lang="ja">{verbPrompt(item)}</span>
                      {answer && <span className="block text-bad" lang="ja">✗ {answer}</span>}
                      <span className="block text-ok" lang="ja">✓ {verbAnswer(item)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link href="/mistakes" className="rounded-2xl border border-line py-3 text-center font-semibold">
            錯題區
          </Link>
          <Link href="/review" className="rounded-2xl bg-accent py-3 text-center font-semibold text-on-accent">
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
          {mode !== "due" && sourceLabel(source)}
          {mode === "due" && KIND_LABEL[item.kind]}
          {item.kind === "quiz" && item.qtype && `・${item.qtype}`}
          {item.kind === "n3" && `・${item.source === "due" ? "到期複習" : "今日新字"}`}
          {mode === "due" && item.kind === "vocab" && item.lesson && `・${item.lesson}`}
        </span>
        <span>
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      {syncBar}
      {item.kind === "quiz" ? (
        <QuizCard key={item.id} item={item} onDone={next} />
      ) : item.kind === "verb" ? (
        <VerbCard key={item.id} item={item} onDone={next} />
      ) : (
        <FlipCard key={item.id} item={item} onDone={next} />
      )}
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

  // 自動比對判對（寫的和正解一樣）：0.6 秒後自動下一題，不用再按
  const autoNext = result?.method === "自動比對" && result.correct === true && !choices && override === null;
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!autoNext) return;
    const t = setTimeout(() => finishRef.current(true), 600);
    return () => clearTimeout(t);
  }, [autoNext]);
  // 選擇題：點完先看對錯，0.8 秒後才出現「下一題」，避免連點跳過
  const [nextReady, setNextReady] = useState(false);
  useEffect(() => {
    if (!result || !choices) return;
    const t = setTimeout(() => setNextReady(true), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <>
      <article className="card mt-2 flex-1 rounded-3xl p-5">
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
                    isCorrect ? "border-ok bg-ok-soft" : isWrongPick ? "border-bad bg-bad-soft" : picked === o.key ? "border-accent" : "border-line"
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
          <p className="mt-3 rounded-xl bg-due-soft px-3 py-2 text-sm text-due">
            上次寫錯：<span lang="ja">{item.myAnswer}</span>
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
        {result && <GradeResultView result={result} answer={choices ? "" : draft.trim()} finalCorrect={finalCorrect} overridden={override !== null} />}
      </article>

      {result && (
        <section className="card mt-3 space-y-2 rounded-[20px] px-[18px] py-4">
          <div className="label">正確答案</div>
          <p className="text-lg leading-relaxed font-bold" lang="ja">
            {item.answer}
          </p>
          {item.explanation && (
            <>
              <div className="label pt-1">解析</div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink-2">{item.explanation}</p>
            </>
          )}
        </section>
      )}
      {result && result.correct !== null && (
        <Overrule
          key={item.id}
          aiSays={result.correct}
          onChange={setOverride}
        />
      )}

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
              className="btn-primary disabled:opacity-40"
            >
              {grading ? "批改中…" : "送出批改"}
            </button>
          </div>
        ) : finalCorrect === null ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => finish(false)} className="rounded-2xl bg-bad py-4 text-lg font-semibold text-on-accent">
              ✗ 錯了
            </button>
            <button type="button" onClick={() => finish(true)} className="rounded-2xl bg-ok py-4 text-lg font-semibold text-on-accent">
              ✓ 對了
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => finish(finalCorrect)}
            className={`btn-primary w-full transition-opacity ${choices && !nextReady ? "pointer-events-none opacity-0" : ""}`}
            aria-hidden={choices && !nextReady ? true : undefined}
          >
            {autoNext ? "答對了，下一題…" : "下一題"}
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

function FlipCard({ item, onDone }: { item: Exclude<ReviewItem, QuizItem | VerbItem>; onDone: (p: Pending) => void }) {
  const [revealed, setRevealed] = useState(false);
  // 背面可以滑：左滑＝會、右滑＝不會（超過 80px 才算）
  const [drag, setDrag] = useState<{ x: number; dx: number } | null>(null);
  const answer = (correct: boolean) => onDone({ item, correct, method: "自評" });
  return (
    <>
      <article
        key={revealed ? "back" : "front"}
        onClick={() => !revealed && setRevealed(true)}
        onPointerDown={(e) => revealed && !(e.target as HTMLElement).closest("a,button") && setDrag({ x: e.clientX, dx: 0 })}
        onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x })}
        onPointerUp={() => {
          if (drag && Math.abs(drag.dx) > 80) answer(drag.dx < 0);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        style={drag ? { transform: `translateX(${drag.dx}px) rotate(${drag.dx / 30}deg)` } : undefined}
        className={`card relative mt-2 flex-1 rounded-3xl p-5 ${revealed ? "flip-in touch-pan-y" : "cursor-pointer"} ${
          drag && drag.dx < -40 ? "ring-2 ring-ok" : drag && drag.dx > 40 ? "ring-2 ring-bad" : ""
        }`}
      >
        {drag && Math.abs(drag.dx) > 40 && (
          <span className={`tag absolute top-4 ${drag.dx < 0 ? "right-4 bg-ok-soft text-ok" : "left-4 bg-bad-soft text-bad"}`}>{drag.dx < 0 ? "✓ 會" : "✕ 不會"}</span>
        )}
        <p
          className={`py-6 text-center font-bold ${item.kind === "grammar" ? "text-3xl" : "text-5xl"}`}
          lang={item.kind === "vocab" && item.lang === "en" ? "en" : "ja"}
        >
          {item.kind === "grammar" ? item.pattern : item.kind === "kanji" ? item.kanji : item.word}
        </p>
        {revealed && (
          <div className="mt-2 border-t border-line pt-4">
            {item.kind === "kanji" ? (
              <KanjiDetail item={item} />
            ) : item.kind === "vocab" ? (
              <VocabDetail item={item} />
            ) : item.kind === "n3" ? (
              <div className="space-y-2 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl" lang="ja">
                  {item.reading}
                  <Speak text={speakableJa(item.reading, item.word)} />
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
            <button type="button" onClick={() => answer(false)} className="rounded-2xl bg-bad py-4 text-lg font-semibold text-on-accent">
              ✗ 不會
            </button>
            <button type="button" onClick={() => answer(true)} className="rounded-2xl bg-ok py-4 text-lg font-semibold text-on-accent">
              ✓ 會
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setRevealed(true)} className="btn-primary w-full">
            看答案
          </button>
        )}
        {revealed && <p className="mt-2 text-center text-xs text-muted">也可以左滑＝會、右滑＝不會</p>}
      </div>
    </>
  );
}

export function KanjiDetail({ item }: { item: KanjiItem }) {
  return (
    <div className="space-y-3" lang="ja">
      <div className="grid grid-cols-[3.5rem_1fr] gap-y-1 text-sm">
        <span className="text-muted">音読み</span>
        <span className="text-base">{item.on || "—"}</span>
        <span className="text-muted">訓読み</span>
        <span className="text-base">{item.kun || "—"}</span>
        <span className="text-muted">意思</span>
        <span className="text-base" lang="zh-Hant">
          {item.meaning}
        </span>
      </div>
      {item.examples.length > 0 && (
        <ul className="divide-y divide-line rounded-xl bg-bg px-3 text-sm">
          {item.examples.map((e, i) => (
            <li key={i} className="flex items-center gap-2 py-1">
              <span className="font-semibold">{e.word}</span>
              <span className="text-muted">{e.reading}</span>
              <Speak text={speakableJa(e.reading, e.word)} />
              <span className="ml-auto text-right" lang="zh-Hant">
                {e.zh}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(item.hint || item.confusable) && (
        <p className="text-xs text-muted" lang="zh-Hant">
          {[item.hint, item.confusable && `易混淆：${item.confusable}`].filter(Boolean).join("　")}
        </p>
      )}
      <p className="text-xs text-muted">{[item.chapter, item.status].filter(Boolean).join("・")}</p>
    </div>
  );
}

function VocabDetail({ item }: { item: VocabItem }) {
  const lang = item.lang === "en" ? "en" : "ja";
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="flex items-center justify-center gap-1 text-2xl" lang={lang}>
          {item.reading}
          <Speak text={lang === "ja" ? speakableJa(item.reading, item.word) : item.word} lang={lang} />
        </p>
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
          <p className="flex items-start gap-1" lang={lang}>
            <span className="flex-1">{e.ja}</span>
            <Speak text={e.ja} lang={lang} label="念例句" />
          </p>
          {e.zh && <p className="text-muted">{e.zh}</p>}
        </div>
      ))}
    </div>
  );
}

// ── 動詞の形：寫出指定的形（或判斷類別），在手機上直接批改 ─────────────

function VerbCard({ item, onDone }: { item: VerbItem; onDone: (p: Pending) => void }) {
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const right = GROUP_OF[item.cls];

  const check = () => setResult(checkConjugation(draft, item.answer));
  const pickGroup = (g: string) => {
    setPicked(g);
    setResult(g === right);
  };
  const finish = () =>
    onDone({ item, correct: result === true, answer: item.mode === "group" ? (picked ?? "") : draft.trim() || undefined, method: "自動比對" });

  return (
    <>
      <article className="mt-2 flex-1 rounded-3xl border border-line bg-card p-5">
        <p className="text-center text-sm text-muted">
          {item.mode === "group" ? "是第幾類動詞？" : FORM_LABEL[item.form as VerbForm]}
        </p>
        <p className="py-4 text-center text-4xl font-bold" lang="ja">
          {item.dict}
        </p>
        <p className="flex items-center justify-center gap-1 text-muted" lang="ja">
          {item.reading}
          {item.meaning && <span className="ml-1">{item.meaning}</span>}
          <Speak text={item.reading} />
        </p>

        {item.mode === "group" ? (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["G1", "G2", "G3"] as const).map((g) => {
              const isRight = result !== null && g === right;
              const isWrongPick = result === false && g === picked;
              return (
                <button
                  key={g}
                  type="button"
                  disabled={result !== null}
                  onClick={() => pickGroup(g)}
                  className={`rounded-2xl border-2 py-4 text-lg font-semibold ${
                    isRight ? "border-ok bg-ok-soft" : isWrongPick ? "border-bad bg-bad-soft" : "border-line"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        ) : result === null ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && draft.trim() && check()}
            placeholder="寫出這個形（漢字或平假名都可以）"
            lang="ja"
            autoFocus
            autoComplete="off"
            className="mt-6 w-full rounded-xl border-2 border-accent bg-bg p-3 text-center text-2xl outline-none"
          />
        ) : null}

        {result !== null && (
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-center">
            <p className={`text-lg font-bold ${result ? "text-ok" : "text-bad"}`}>{result ? "✓ 正確" : "✗ 錯誤"}</p>
            {item.mode === "conj" && !result && draft.trim() && (
              <p className="text-muted" lang="ja">
                你寫的：{draft}
              </p>
            )}
            <p className="flex items-center justify-center gap-1 text-2xl font-semibold text-ok" lang="ja">
              {item.mode === "group" ? `${right}（${item.cls}）` : item.answer.word}
              {item.mode === "conj" && <Speak text={item.answer.reading} />}
            </p>
            {item.mode === "conj" && item.answer.word !== item.answer.reading && (
              <p className="text-muted" lang="ja">
                {item.answer.reading}
              </p>
            )}
            {specialNote(item, item.form as VerbForm) && (
              <p className="rounded-xl bg-due-soft px-3 py-1.5 text-sm text-due">特殊：{specialNote(item, item.form as VerbForm)}</p>
            )}
            <p className="text-left text-xs leading-relaxed text-muted" lang="ja">
              {item.mode === "group" ? "G1＝五段、G2＝一段（い段／え段＋る）、G3＝する・来る。〜る 結尾的 G1（帰る・入る・知る・走る・切る）要特別記。" : FORM_RULE[item.form as VerbForm]}
            </p>
          </div>
        )}
      </article>

      <div className="sticky bottom-24 mt-4">
        {result === null ? (
          item.mode === "conj" ? (
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <button type="button" onClick={() => setResult(false)} className="rounded-2xl border border-line py-4 font-semibold text-muted">
                不會
              </button>
              <button
                type="button"
                onClick={check}
                disabled={!draft.trim()}
                className="rounded-2xl bg-ink py-4 text-lg font-semibold text-bg disabled:opacity-40"
              >
                批改
              </button>
            </div>
          ) : null
        ) : (
          <button type="button" onClick={finish} className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-on-accent">
            下一題
          </button>
        )}
      </div>
    </>
  );
}

/** 批改結果：對錯標示、AI 評語、逐字差異（你寫的／改正） */
function GradeResultView({
  result,
  answer,
  finalCorrect,
  overridden,
}: {
  result: GradeResult;
  answer: string;
  finalCorrect: boolean | null;
  overridden: boolean;
}) {
  const diff = answer && result.suggestion && !finalCorrect ? charDiff(answer, result.suggestion) : null;
  return (
    <div className="mt-4 space-y-3">
      {finalCorrect !== null && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-bold ${finalCorrect ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}
        >
          <span className={`grid size-[22px] place-items-center rounded-full text-xs text-card ${finalCorrect ? "bg-ok" : "bg-bad"}`}>{finalCorrect ? "✓" : "✕"}</span>
          {finalCorrect ? "正確" : "錯誤"}
          <span className="tag ml-auto bg-card text-muted">{overridden ? "已改判" : result.method === "AI" ? "AI 批改" : result.method}</span>
        </div>
      )}
      {result.feedback && <p className="text-[15px] leading-relaxed">{result.feedback}</p>}
      {diff ? (
        <div className="grid grid-cols-[52px_1fr] items-baseline gap-y-2.5">
          <span className="label">你寫的</span>
          <span className="text-lg leading-relaxed" lang="ja">
            {diff.mine.map((d, i) =>
              d.op === "del" ? (
                <del key={i} className="rounded-sm bg-bad-soft text-bad decoration-2">
                  {d.text}
                </del>
              ) : (
                <span key={i}>{d.text}</span>
              ),
            )}
          </span>
          <span className="label">改正</span>
          <span className="text-lg leading-relaxed" lang="ja">
            {diff.fixed.map((d, i) =>
              d.op === "ins" ? (
                <ins key={i} className="rounded-sm bg-ok-soft text-ok underline decoration-2 underline-offset-4">
                  {d.text}
                </ins>
              ) : (
                <span key={i}>{d.text}</span>
              ),
            )}
          </span>
        </div>
      ) : (
        answer && (
          <p className="text-muted">
            你的答案：<span lang="ja">{answer}</span>
          </p>
        )
      )}
    </div>
  );
}

/** 「批改有誤？改判為對／錯」：改判後 5 秒內可以復原 */
function Overrule({ aiSays, onChange }: { aiSays: boolean; onChange: (v: boolean | null) => void }) {
  const [state, setState] = useState<"none" | "undoable" | "fixed">("none");
  useEffect(() => {
    if (state !== "undoable") return;
    const t = setTimeout(() => setState("fixed"), 5000);
    return () => clearTimeout(t);
  }, [state]);
  const to = aiSays ? "錯" : "對";
  if (state === "fixed") return <p className="mt-2 text-center text-sm text-muted">已改判為{to}</p>;
  return (
    <button
      type="button"
      onClick={() => {
        const next = state === "none";
        setState(next ? "undoable" : "none");
        onChange(next ? !aiSays : null);
      }}
      className="mx-auto mt-2 block h-11 px-3 text-sm font-semibold text-ink-2 underline underline-offset-4"
    >
      {state === "undoable" ? `已改判為${to}・復原` : `批改有誤？改判為${to}`}
    </button>
  );
}
