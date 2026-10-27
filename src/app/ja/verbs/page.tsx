import { Speak } from "@/components/Speak";
import Link from "next/link";
import { FORMS, FORM_LABEL, FORM_RULE, GROUP_OF, conjugate, formException, isIRowIchidan, looksLikeIchidan, type VerbForm } from "@/lib/conjugate";
import { getVerbs } from "@/lib/data";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "動詞變化表・Study Hub" };

const GROUP_TITLE = { G1: "G1（五段）", G2: "G2（一段）", G3: "G3（する・来る）" } as const;

export default async function VerbTablePage({ searchParams }: { searchParams: Promise<{ form?: string }> }) {
  const q = await searchParams;
  const form: VerbForm = (FORMS as readonly string[]).includes(q.form ?? "") ? (q.form as VerbForm) : "意向";
  const verbs = (await getVerbs()).sort((a, b) => a.reading.localeCompare(b.reading, "ja"));
  const rows = verbs.flatMap((v) => {
    const c = conjugate(v, form);
    return c ? [{ v, c }] : [];
  });
  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 mb-3 text-[28px] leading-[34px] font-bold">動詞變化表</h1>

      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {FORMS.map((f) => (
          <Link
            key={f}
            href={`/ja/verbs?form=${encodeURIComponent(f)}`}
            scroll={false}
            className={`flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${f === form ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
          >
            {FORM_LABEL[f].replace(/（.*）/, "")}
          </Link>
        ))}
      </nav>

      <section className="mb-4 card p-4 text-sm leading-relaxed" lang="ja">
        <div className="mb-1 font-semibold">{FORM_LABEL[form]}</div>
        {FORM_RULE[form].split("／").map((r) => (
          <p key={r}>{r}</p>
        ))}
        <p className="mt-2 text-xs text-muted" lang="zh-Hant">
          標 <span className="rounded bg-due px-1 text-[10px] font-semibold text-card">特殊</span> 的要特別記：G1 裡長得像 G2 的、G2 裡い段＋る 的，以及這個形的例外。
        </p>
      </section>

      {rows.length === 0 && <p className="text-muted">單字庫裡沒有這個形的動詞</p>}
      <div className="mb-24 space-y-3">
        {(["G1", "G2", "G3"] as const).map((g) => {
          const list = rows.filter((r) => GROUP_OF[r.v.cls] === g);
          if (!list.length) return null;
          // 每組先列要特別記的：G1 裡長得像 G2 的、G2 裡い段＋る 的
          const parts =
            g === "G1"
              ? [
                  { title: "特殊：〜る 結尾、長得像 G2，其實是 G1", rows: list.filter((r) => looksLikeIchidan(r.v)), special: true },
                  { title: "其他 G1", rows: list.filter((r) => !looksLikeIchidan(r.v)), special: false },
                ]
              : g === "G2"
                ? [
                    { title: "特殊：い段＋る（G2 大多是え段＋る，い段的要特別記）", rows: list.filter((r) => isIRowIchidan(r.v)), special: true },
                    { title: "え段＋る", rows: list.filter((r) => !isIRowIchidan(r.v)), special: false },
                  ]
                : [{ title: "", rows: list, special: false }];
          return (
            <details key={g} open className="card">
              <summary className="cursor-pointer px-4 py-3 font-semibold">
                {GROUP_TITLE[g]} <span className="font-normal text-muted">{list.length}</span>
              </summary>
              {parts
                .filter((part) => part.rows.length)
                .map((part) => (
                  <div key={part.title || g}>
                    {part.title && (
                      <div className={`border-t border-line px-4 py-2 text-xs font-semibold ${part.special ? "bg-due-soft text-due" : "text-muted"}`}>
                        {part.title}・{part.rows.length}
                      </div>
                    )}
                    <table className="w-full text-sm" lang="ja">
                      <tbody className="divide-y divide-line border-t border-line">
                        {part.rows.map(({ v, c }) => {
                          const exception = formException(v, form);
                          return (
                            <tr key={v.id} className={part.special ? "bg-due-soft/40" : ""}>
                              <td className="py-2 pl-4">
                                <span className="inline-flex items-center gap-1">
                                  {v.dict}
                                  {(part.special || exception) && (
                                    <span className="rounded bg-due px-1 text-[10px] leading-4 font-semibold text-card">特殊</span>
                                  )}
                                </span>
                                <span className="block text-xs text-muted">{v.reading}</span>
                              </td>
                              <td className="py-2 font-semibold">
                                {c.word}
                                {c.word !== c.reading && <span className="block text-xs font-normal text-muted">{c.reading}</span>}
                                {exception && (
                                  <span className="block text-xs font-normal text-accent" lang="zh-Hant">
                                    {exception}
                                  </span>
                                )}
                              </td>
                              <td className="w-8 py-2">
                                <Speak text={c.reading} />
                              </td>
                              <td className="py-2 pr-4 text-right text-xs text-muted">{v.meaning}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
            </details>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-20 mx-auto max-w-xl px-4 md:max-w-2xl">
        <Link
          href={`/review/questions?forms=${encodeURIComponent(form)}`}
          className="block rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-on-accent shadow-lg"
        >
          練習{FORM_LABEL[form].replace(/（.*）/, "")}
        </Link>
      </div>
    </>
  );
}
