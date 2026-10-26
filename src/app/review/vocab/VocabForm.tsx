"use client";
import Link from "next/link";
import { useState } from "react";
import { Chips, Field } from "@/components/Chips";
import { LESSON_COUNT, LEVELS, sourceQuery } from "@/lib/reviewSource";

const COUNTS = [10, 20, 30, 50] as const;

export function VocabForm({ counts }: { counts: Record<string, number> }) {
  const [level, setLevel] = useState<string>("初中級");
  const [picked, setPicked] = useState<number[]>([]);
  const [count, setCount] = useState<number>(20);
  const lessons = Array.from({ length: LESSON_COUNT }, (_, i) => i + 1).filter((n) => counts[`${level} L${n}`]);
  const total = (picked.length ? picked : lessons).reduce((s, n) => s + (counts[`${level} L${n}`] ?? 0), 0);
  const href = `/review/session?${sourceQuery({ src: "vocab", lang: "ja", level, lessons: picked, count })}`;

  return (
    <>
      <Field title="冊">
        <Chips
          options={LEVELS}
          value={[level as (typeof LEVELS)[number]]}
          onToggle={(l) => {
            setLevel(l);
            setPicked([]);
          }}
        />
      </Field>
      <Field title="課" hint={`共 ${total} 個字${picked.length ? "" : "（不選＝全部）"}`}>
        {lessons.length ? (
          <Chips
            options={lessons}
            value={picked}
            onToggle={(n) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort((a, b) => a - b)))}
            label={(n) => `L${n}・${counts[`${level} L${n}`]}`}
          />
        ) : (
          <p className="text-sm text-muted">單字庫還沒有這冊的課次（請 Notion AI 補「課次」欄）</p>
        )}
      </Field>
      <Field title="題數">
        <Chips options={COUNTS} value={[count as (typeof COUNTS)[number]]} onToggle={setCount} label={(n) => `${n} 個`} />
      </Field>
      <p className="mb-24 text-xs text-muted">看字 → 想讀音和意思 → 翻卡自評。忘記的、學習中的先出；結果寫回單字庫熟悉度。</p>
      <div className="fixed inset-x-0 bottom-20 mx-auto max-w-xl px-4 md:max-w-2xl">
        <Link href={href} className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-white shadow-lg">
          開始測驗
        </Link>
      </div>
    </>
  );
}
