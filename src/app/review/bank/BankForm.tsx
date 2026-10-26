"use client";
import Link from "next/link";
import { useState } from "react";
import { Chips, Field } from "@/components/Chips";
import { LEVELS, QTYPES, sourceQuery } from "@/lib/reviewSource";

const COUNTS = [10, 20, 30] as const;

export function BankForm({ lessons }: { lessons: Record<string, number[]> }) {
  const [level, setLevel] = useState<string>("初中級");
  const [picked, setPicked] = useState<number[]>([]);
  const [qtypes, setQtypes] = useState<string[]>([]);
  const [scope, setScope] = useState<"weak" | "all">("weak");
  const [count, setCount] = useState<number>(20);
  const available = lessons[level] ?? [];

  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const href = `/review/session?${sourceQuery({
    src: "bank",
    level,
    lessons: picked,
    qtype: qtypes[0] ?? null,
    scope,
    count,
  })}`;

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
      <Field title="課" hint={picked.length ? `已選 ${picked.length} 課` : "不選＝全部"}>
        {available.length ? (
          <Chips options={available} value={picked} onToggle={(n) => setPicked((p) => toggle(p, n).sort((a, b) => a - b))} label={(n) => `L${n}`} />
        ) : (
          <p className="text-sm text-muted">這冊還沒有課堂筆記</p>
        )}
      </Field>
      <Field title="題型" hint="不選＝全部">
        <Chips options={QTYPES} value={qtypes} onToggle={(t) => setQtypes((q) => (q.includes(t) ? [] : [t]))} />
      </Field>
      <Field title="範圍">
        <Chips
          options={["weak", "all"] as const}
          value={[scope]}
          onToggle={setScope}
          label={(s) => (s === "weak" ? "錯過＋沒做過" : "全部（含答對過）")}
        />
      </Field>
      <Field title="題數">
        <Chips options={COUNTS} value={[count as (typeof COUNTS)[number]]} onToggle={setCount} label={(n) => `${n} 題`} />
      </Field>
      <p className="mb-24 text-xs text-muted">對錯會照常寫回題庫（下次複習日期也會跟著更新）和作答紀錄，答錯的會進錯題區。</p>
      <div className="fixed inset-x-0 bottom-20 mx-auto max-w-xl px-4 md:max-w-2xl">
        <Link href={href} className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-white shadow-lg">
          開始練習
        </Link>
      </div>
    </>
  );
}
