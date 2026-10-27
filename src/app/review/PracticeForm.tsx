"use client";
import Link from "next/link";
import { useState } from "react";
import { Chips, Field } from "@/components/Chips";
import { FORMS, FORM_LABEL } from "@/lib/conjugate";
import { GROUPS, LESSON_COUNT, LEVELS, QTYPES, sourceQuery } from "@/lib/reviewSource";

// 依作答方式分兩格：單字・漢字（翻卡自評）／題目練習（寫答案、批改）
const TYPES = { words: ["日文", "英文", "漢字"], questions: ["題庫", "動詞の形"] } as const;
type PracticeType = (typeof TYPES)[keyof typeof TYPES][number];
const SOON: Partial<Record<PracticeType, string>> = {};

export type PracticePreset = {
  mode: "words" | "questions";
  lang: "ja" | "en";
  level: string;
  lessons: number[];
  /** 從動詞變化表「練習這個形」過來 */
  verbForms: string[];
  /** 從漢字表「練習這章」過來；沒有就預設下一場漢字テスト的範圍 */
  kanjiChapters: string[];
  kanji: boolean;
};

export function PracticeForm({
  noteLessons,
  vocabCounts,
  englishCount,
  kanjiCounts,
  preset,
}: {
  noteLessons: Record<string, number[]>;
  vocabCounts: Record<string, number>;
  englishCount: number;
  kanjiCounts: Record<string, number>;
  preset: PracticePreset;
}) {
  const types = TYPES[preset.mode];
  const [type, setType] = useState<PracticeType>(
    preset.mode === "words"
      ? preset.kanji
        ? "漢字"
        : preset.lang === "en"
          ? "英文"
          : "日文"
      : preset.verbForms.length
        ? "動詞の形"
        : "題庫",
  );
  const [chapters, setChapters] = useState<string[]>(preset.kanjiChapters);
  const kanjiChapters = Object.keys(kanjiCounts);
  const kanjiTotal = (chapters.length ? chapters : kanjiChapters).reduce((s, c) => s + (kanjiCounts[c] ?? 0), 0);
  const [verbForms, setVerbForms] = useState<string[]>(preset.verbForms.length ? preset.verbForms : ["意向"]);
  const [groups, setGroups] = useState<string[]>([]);
  const [judge, setJudge] = useState(true);
  const lang = type === "英文" ? "en" : "ja";
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
    type === "漢字"
      ? `/review/session?${sourceQuery({ src: "kanji", chapters, count })}`
      : type === "動詞の形"
      ? `/review/session?${sourceQuery({ src: "verb", forms: verbForms, groups, judge, count })}`
      : type === "題庫"
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
      <div role="tablist" className={`mb-5 grid gap-1 rounded-2xl bg-line/60 p-1 ${types.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {types.map((t) => (
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
        <p className="card p-4 text-sm text-muted">{soon}</p>
      ) : type === "漢字" ? (
        <>
          <Field title="章" hint={`共 ${kanjiTotal} 字${chapters.length ? "" : "（不選＝全部）"}`}>
            {kanjiChapters.length ? (
              <Chips
                options={kanjiChapters}
                value={chapters}
                onToggle={(c) => setChapters((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}
                label={(c) => `${c.replace("HSJ", "")}・${kanjiCounts[c]}`}
              />
            ) : (
              <p className="text-sm text-muted">漢字庫還沒有資料</p>
            )}
          </Field>
          {countField([10, 20, 30, 50], "字")}
          <p className="mb-24 text-xs text-muted">看漢字 → 想音読み、訓読み和意思 → 翻卡自評。忘記的先出；結果寫回漢字庫的熟悉度和下次複習日。</p>
        </>
      ) : type === "動詞の形" ? (
        <>
          <Field title="形" hint="可以複選">
            <Chips
              options={FORMS}
              value={verbForms as (typeof FORMS)[number][]}
              onToggle={(f) => setVerbForms((xs) => (xs.includes(f) ? (xs.length > 1 ? xs.filter((x) => x !== f) : xs) : [...xs, f]))}
              label={(f) => FORM_LABEL[f].replace(/（.*）/, "")}
            />
          </Field>
          <Field title="動詞類別" hint="不選＝全部">
            <Chips options={GROUPS} value={groups as (typeof GROUPS)[number][]} onToggle={(g) => setGroups((xs) => (xs.includes(g) ? xs.filter((x) => x !== g) : [...xs, g]))} />
          </Field>
          <Field title="判斷類別題">
            <Chips options={["on", "off"] as const} value={[judge ? "on" : "off"]} onToggle={(v) => setJudge(v === "on")} label={(v) => (v === "on" ? "穿插（約每 4 題 1 題）" : "不要")} />
          </Field>
          {countField([10, 20, 30], "題")}
          <p className="mb-24 text-xs text-muted">動詞來自單字庫（日文活用＝五段／一段／サ変／カ変）。漢字或平假名都算對；結果寫進作答紀錄。</p>
        </>
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
          <Link href={href} className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-on-accent shadow-lg">
            開始練習
          </Link>
        </div>
      )}
    </>
  );
}
