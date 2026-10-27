import { Speak } from "@/components/Speak";
import Link from "next/link";
import {
  FORMS,
  FORM_LABEL,
  FORM_MEANING,
  GROUP_OF,
  conjugate,
  formException,
  groupRule,
  isIRowIchidan,
  looksLikeIchidan,
  type Conjugated,
  type Verb,
  type VerbForm,
} from "@/lib/conjugate";
import { getVerbs } from "@/lib/data";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "動詞變化表・Study Hub" };

const GROUPS = ["G1", "G2", "G3"] as const;
type Group = (typeof GROUPS)[number];
const GROUP_NAME: Record<Group, string> = { G1: "五段", G2: "一段", G3: "する・来る" };
// G1 依結尾假名分段（變化規則就是依結尾分的）
const G1_ENDINGS = [..."うくぐすつぬぶむる"];

type Row = { v: Verb & { id: string; meaning: string }; c: Conjugated };
type Part = { id: string; title: string; hint?: string; rows: Row[]; special: boolean };

/** 這一段多數動詞的變化：「〜く → 〜いて」（例外動詞不算） */
function tailRule(rows: Row[], form: VerbForm): string | undefined {
  const count = new Map<string, number>();
  for (const { v, c } of rows) {
    if (formException(v, form)) continue;
    let i = 0;
    while (i < v.reading.length && i < c.reading.length && v.reading[i] === c.reading[i]) i++;
    i = Math.min(i, v.reading.length - 1);
    const rule = `〜${v.reading.slice(i)} → 〜${c.reading.slice(i)}`;
    count.set(rule, (count.get(rule) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function partsOf(g: Group, list: Row[], form: VerbForm): Part[] {
  if (g === "G1") {
    const special = list.filter((r) => looksLikeIchidan(r.v));
    const rest = list.filter((r) => !looksLikeIchidan(r.v));
    return [
      { id: "special", title: "特殊：〜る 結尾、長得像 G2，其實是 G1", rows: special, special: true },
      ...G1_ENDINGS.map((k) => {
        const rows = rest.filter((r) => r.v.reading.endsWith(k));
        return { id: `end-${k}`, title: `〜${k}`, hint: tailRule(rows, form), rows, special: false };
      }),
      // 結尾不在上面的（資料怪的）放最後
      { id: "other", title: "其他", rows: rest.filter((r) => !G1_ENDINGS.some((k) => r.v.reading.endsWith(k))), special: false },
    ];
  }
  if (g === "G2")
    return [
      { id: "special", title: "特殊：い段＋る（G2 大多是え段＋る，い段的要特別記）", rows: list.filter((r) => isIRowIchidan(r.v)), special: true },
      { id: "e-row", title: "え段＋る", rows: list.filter((r) => !isIRowIchidan(r.v)), special: false },
    ];
  return [
    { id: "kuru", title: "来る", rows: list.filter((r) => r.v.cls === "カ変"), special: false },
    { id: "suru", title: "〜する", rows: list.filter((r) => r.v.cls !== "カ変"), special: false },
  ];
}

const href = (form: VerbForm, g: Group) => `/ja/verbs?${new URLSearchParams({ form, g })}`;

export default async function VerbTablePage({ searchParams }: { searchParams: Promise<{ form?: string; g?: string }> }) {
  const q = await searchParams;
  const form: VerbForm = (FORMS as readonly string[]).includes(q.form ?? "") ? (q.form as VerbForm) : "意向";
  const group: Group = GROUPS.find((g) => g === q.g) ?? "G1";
  const verbs = (await getVerbs()).sort((a, b) => a.reading.localeCompare(b.reading, "ja"));
  const rows: Row[] = verbs.flatMap((v) => {
    const c = conjugate(v, form);
    return c ? [{ v, c }] : [];
  });
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, rows.filter((r) => GROUP_OF[r.v.cls] === g)])) as Record<Group, Row[]>;
  const parts = partsOf(group, byGroup[group], form).filter((p) => p.rows.length);
  const formName = FORM_LABEL[form].replace(/（.*）/, "");

  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 mb-2 text-[28px] leading-[34px] font-bold">動詞變化表</h1>

      {/* 常駐頂列：形＋組，捲到哪裡都能切 */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 space-y-2 border-b border-line bg-bg px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2.5">
        <nav aria-label="形" className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          {FORMS.map((f) => (
            <Link
              key={f}
              href={href(f, group)}
              scroll={false}
              aria-current={f === form ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${f === form ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
            >
              {FORM_LABEL[f].replace(/（.*）/, "")}
            </Link>
          ))}
        </nav>
        <nav aria-label="動詞分組" className="grid grid-cols-3 gap-1 rounded-[14px] bg-card-2 p-1">
          {GROUPS.map((g) => (
            <Link
              key={g}
              href={href(form, g)}
              scroll={false}
              aria-current={g === group ? "page" : undefined}
              className={`flex h-11 flex-col items-center justify-center rounded-[10px] leading-tight ${g === group ? "bg-card text-ink shadow-card" : "text-ink-2"}`}
            >
              <span className="text-sm font-bold">
                {g} <span className="font-semibold text-muted tabular-nums">{byGroup[g].length}</span>
              </span>
              <span className="text-[11px]" lang="ja">
                {GROUP_NAME[g]}
              </span>
            </Link>
          ))}
        </nav>
        {parts.length > 2 && (
          <nav aria-label="跳到" className="-mx-4 flex gap-1 overflow-x-auto px-4" lang="ja">
            {parts.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className={`flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[13px] font-semibold ${p.special ? "bg-due-soft text-due" : "bg-card text-ink-2"}`}
              >
                {p.special ? "特殊" : p.title}
                <span className="ml-1 text-[11px] font-medium opacity-70">{p.rows.length}</span>
              </a>
            ))}
          </nav>
        )}
      </div>

      <section className="card mb-3 space-y-2 px-4 py-3 text-sm leading-relaxed">
        <div>
          <div className="label">{formName}是什麼</div>
          <p className="mt-0.5 text-[15px] font-semibold">{FORM_MEANING[form].meaning}</p>
          <ul className="mt-1 space-y-0.5 text-ink-2">
            {FORM_MEANING[form].uses.map((u) => (
              <li key={u} className="flex gap-1.5">
                <span className="text-muted">・</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 rounded-xl bg-card-2 px-3 py-2">
            <span className="block" lang="ja">
              {FORM_MEANING[form].example[0]}
            </span>
            <span className="block text-xs text-muted">{FORM_MEANING[form].example[1]}</span>
          </p>
        </div>
        <div className="label border-t border-line pt-2">
          怎麼變・{group}
        </div>
        <ul lang="ja">
          {groupRule(form, group).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-muted">
          標 <span className="rounded bg-due px-1 text-[10px] font-semibold text-card">特殊</span> 的要特別記：長得像別組的動詞，以及這個形的例外。
        </p>
      </section>

      {rows.length === 0 && <p className="text-muted">單字庫裡沒有這個形的動詞</p>}
      {rows.length > 0 && parts.length === 0 && <p className="text-muted">單字庫裡沒有 {group} 的動詞</p>}

      <div className="mb-24 space-y-3">
        {parts.map((part) => (
          <section key={part.id} id={part.id} className="card scroll-mt-48 overflow-hidden">
            <h2 className={`flex items-baseline gap-2 px-4 py-2 text-[13px] font-bold ${part.special ? "bg-due-soft text-due" : "text-ink-2"}`} lang="ja">
              {part.title}
              <span className="font-medium opacity-70">{part.rows.length}</span>
              {part.hint && <span className="ml-auto font-semibold text-accent">{part.hint}</span>}
            </h2>
            <ul className="divide-y divide-line border-t border-line" lang="ja">
              {part.rows.map(({ v, c }) => {
                const exception = formException(v, form);
                return (
                  <li key={v.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 py-1.5 pl-4">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1">
                        <span className="truncate">{v.dict}</span>
                        {(part.special || exception) && <span className="shrink-0 rounded bg-due px-1 text-[10px] leading-4 font-semibold text-card">特殊</span>}
                      </span>
                      <span className="block truncate text-xs text-muted" lang="zh-Hant">
                        {v.meaning}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.word}</span>
                      {c.word !== c.reading && <span className="block text-xs text-muted">{c.reading}</span>}
                      {exception && (
                        <span className="block text-xs text-due" lang="zh-Hant">
                          {exception}
                        </span>
                      )}
                    </span>
                    <Speak text={c.reading} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom)+12px)] mx-auto max-w-xl px-4 md:max-w-[760px]">
        <Link href={`/review/questions?${new URLSearchParams({ forms: form, groups: group })}`} className="btn-primary">
          練習 {group} 的{formName}
        </Link>
      </div>
    </>
  );
}
