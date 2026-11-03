import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { ReviewSession } from "../../ReviewSession";
import { parseLessons } from "@/lib/reviewSource";

export const metadata = { title: "考試複習・Study Hub" };

// 現在的課程是初中級（同 /review/exam）
const LEVEL = "初中級";

const TABS = [
  { key: "vocab", label: "語彙", qtype: "A 單字選擇" },
  { key: "grammar", label: "文法", qtype: "B 文法填空" },
] as const;

/** アチーブ「語彙・文法」：上方切換語彙（題庫 A）／文法（題庫 B），下面直接出題 */
export default async function ExamBankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const lessons = parseLessons(q.lessons ?? null);
  const tab = TABS.find((t) => t.key === q.t) ?? TABS[0];
  const link = (t: string) => `/review/exam/bank?${new URLSearchParams({ lessons: lessons.join(","), title: q.title ?? "", t })}`;
  return (
    <>
      <BackLink href="/review/exam">考試複習</BackLink>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-lg font-bold">{q.title || "語彙・文法"}</h1>
        <div className="flex shrink-0 rounded-full border border-line p-0.5 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={link(t.key)}
              replace
              aria-current={t.key === tab.key ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 font-semibold ${t.key === tab.key ? "bg-accent text-on-accent" : "text-ink-2"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <ReviewSession key={tab.key} source={{ src: "bank", level: LEVEL, lessons, qtype: tab.qtype, scope: "all", count: 30 }} />
    </>
  );
}
