import { EntryCard } from "@/components/EntryCard";
import { BackLink } from "@/components/BackLink";
import { parseLessons, sourceQuery } from "@/lib/reviewSource";

export const metadata = { title: "考試複習・Study Hub" };

// 現在的課程是初中級（同 /review/exam）
const LEVEL = "初中級";

/** アチーブ「語彙・文法」：選語彙題（題庫 A）或文法題（題庫 B） */
export default async function ExamBankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const lessons = parseLessons(q.lessons ?? null);
  const range = lessons.length ? `${LEVEL} L${lessons[0]}–${lessons[lessons.length - 1]}` : LEVEL;
  const href = (qtype: "A 單字選擇" | "B 文法填空") => `/review/session?${sourceQuery({ src: "bank", level: LEVEL, lessons, qtype, scope: "all", count: 30 })}`;
  return (
    <>
      <BackLink href="/review/exam">考試複習</BackLink>
      <h1 className="mt-1 mb-1 text-[28px] leading-[34px] font-bold">{q.title ?? "語彙・文法"}</h1>
      <p className="mb-4 text-sm text-muted">{range} 的題庫，選一種開始</p>
      <div className="space-y-2.5">
        <EntryCard href={href("A 單字選擇")} icon="cards" title="語彙" detail="題庫 A 單字選擇" />
        <EntryCard href={href("B 文法填空")} icon="pencil" title="文法" detail="題庫 B 文法填空" />
      </div>
    </>
  );
}
