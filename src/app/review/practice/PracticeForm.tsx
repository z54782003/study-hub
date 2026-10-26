"use client";
import Link from "next/link";
import { useState } from "react";
import { Chips, Field } from "@/components/Chips";
import { LESSON_COUNT, LEVELS, QTYPES, sourceQuery } from "@/lib/reviewSource";

const TYPES = ["題庫", "單字", "漢字", "動詞の形"] as const;
type PracticeType = (typeof TYPES)[number];
const SOON: Partial<Record<PracticeType, string>> = {
  漢字: "漢字庫（HSJⅡ）整理好後開放",
  動詞の形: "準備中：會依單字庫的活用分類自動出題",
};

export type PracticePreset = { type: "bank" | "vocab"; lang: "ja" | "en"; level: string; lessons: number[] };

export function PracticeForm({
  noteLessons,
  vocabCounts,
  englishCount,
  preset,
}: {
  noteLessons: Record<string, number[]>;
  vocabCounts: Record<string, number>;
  englishCount: number;
  preset: PracticePreset;
}) {
  const [type, setType] = useState<PracticeType>(preset.type === "vocab" ? "單字" : "題庫");
  const [lang, setLang] = useState<"ja" | "en">(preset.lang);
  const [level, setLevel] = useState<string>(preset.level);
  const [picked, setPicked] = useState<number[]>(preset.lessons);
  const [qtype, setQtype] = useState<string | null>(null);
  const [scope, setScope] = useState<"weak" | "all">("weak");
  const [count, setCount] = useState<number>(20);

  const toggle = (n: number) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort((a, b) => a - b)));
  const pickLevel = (l: string) => {
    setLevel(l);
    setPicked([]);
  };

  const vocabLessons = Array.from({ length: LESSON_COUNT }, (_, i) => i + 1).filter((n) => vocabCounts[`${level} L${n}`]);
  const vocabTotal = (picked.length ? picked : vocabLessons).reduce((s, n) => s + (vocabCounts[`${level} L${n}`] ?? 0), 0);
  const bankLessons = noteLessons[level] ?? [];

  const href =
    type === "題庫"
      ? `/review/session?${sourceQuery({ src: "bank", level, lessons: picked, qtype, scope, count })}`
      : `/review/session?${sourceQuery({ src: "vocab", lang, level: lang === "ja" ? level : null, lessons: lang === "ja" ? picked : [], count })}`;
  const soon = SOON[type];
  const levelField = (
    <Field title="冊">
      <Chips options={LEVELS} value={[level as (typeof LEVELS)[number]]} onToggle={pickLevel} />
    </Field>
  );
  const countField = (options: readonly number[], unit: string) => (
    <Field title="題數">
      <Chips options={options} value={[count]} onToggle={setCount} label={(n) => `${n} ${unit}`} />
    </Field>
  );

  return (
    <>
      <div role="tablist" className="mb-5 grid grid-cols-4 gap-1 rounded-2xl bg-line/60 p-1">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === type}
            onClick={() => setType(t)}
            className={`rounded-xl py-2 text-sm font-semibold ${t === type ? "bg-card shadow-sm" : "text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {soon ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">{soon}</p>
      ) : type === "題庫" ? (
        <>
          {levelField}
          <Field title="課" hint={picked.length ? `已選 ${picked.length} 課` : "不選＝全部"}>
            {bankLessons.length ? (
              <Chips options={bankLessons} value={picked} onToggle={toggle} label={(n) => `L${n}`} />
            ) : (
              <p className="text-sm text-muted">這冊還沒有課堂筆記</p>
            )}
          </Field>
          <Field title="題型" hint="不選＝全部">
            <Chips options={QTYPES} value={qtype ? [qtype as (typeof QTYPES)[number]] : []} onToggle={(t) => setQtype((q) => (q === t ? null : t))} />
          </Field>
          <Field title="範圍">
            <Chips
              options={["weak", "all"] as const}
              value={[scope]}
              onToggle={setScope}
              label={(s) => (s === "weak" ? "錯過＋沒做過" : "全部（含答對過）")}
            />
          </Field>
          {countField([10, 20, 30], "題")}
          <p className="mb-24 text-xs text-muted">對錯會照常寫回題庫（下次複習日期也會跟著更新）和作答紀錄，答錯的會進錯題區。</p>
        </>
      ) : (
        <>
          <Field title="語言">
            <Chips options={["ja", "en"] as const} value={[lang]} onToggle={setLang} label={(l) => (l === "ja" ? "日文" : "英文")} />
          </Field>
          {lang === "ja" ? (
            <>
              {levelField}
              <Field title="課" hint={`共 ${vocabTotal} 個字${picked.length ? "" : "（不選＝全部）"}`}>
                {vocabLessons.length ? (
                  <Chips options={vocabLessons} value={picked} onToggle={toggle} label={(n) => `L${n}・${vocabCounts[`${level} L${n}`]}`} />
                ) : (
                  <p className="text-sm text-muted">單字庫還沒有這冊的課次（請 Notion AI 補「課次」欄）</p>
                )}
              </Field>
            </>
          ) : (
            <p className="mb-5 text-sm text-muted">英文單字庫還沒精通的字 {englishCount} 個（大多是從 TED 播放器加進來的）。</p>
          )}
          {countField([10, 20, 30, 50], "個")}
          <p className="mb-24 text-xs text-muted">看字 → 想讀音和意思 → 翻卡自評。忘記的、學習中的先出；結果寫回單字庫熟悉度。</p>
        </>
      )}

      {!soon && (
        <div className="fixed inset-x-0 bottom-20 mx-auto max-w-xl px-4 md:max-w-2xl">
          <Link href={href} className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-white shadow-lg">
            開始練習
          </Link>
        </div>
      )}
    </>
  );
}
