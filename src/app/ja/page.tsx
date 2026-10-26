import { EntryCard } from "@/components/EntryCard";
import { EXAMS, NHK_EASY_URL } from "@/lib/config";
import { recentClassNotes, today } from "@/lib/data";
import { diffDays, formatJP } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "日文・Study Hub" };

export default async function JapanesePage() {
  const day = today();
  const notes = await recentClassNotes(6).catch(() => []);
  const exams = EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) }))
    .filter((e) => e.daysLeft >= 0)
    .slice(0, 3);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">日文</h1>

      {exams.length > 0 && (
        <section className="mb-5 rounded-2xl border border-line bg-card px-4 py-3">
          <h2 className="mb-2 text-sm font-semibold">接下來的考試</h2>
          <ul className="space-y-1.5 text-sm">
            {exams.map((e) => (
              <li key={e.date + e.name} className="flex gap-3">
                <span className="w-14 shrink-0 tabular-nums text-muted">{e.date.slice(5).replace("-", "/")}</span>
                <span className="min-w-0 flex-1">
                  {e.name}
                  <span className="block text-xs text-muted">{e.scope}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${e.daysLeft <= 3 ? "font-semibold text-accent" : "text-muted"}`}>
                  {e.daysLeft === 0 ? "今天" : `${e.daysLeft} 天`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 text-sm font-semibold text-muted">單字・文法</h2>
      <div className="space-y-2.5">
        <EntryCard href="/n3" icon="🈁" title="N3 單字・今日文型" detail="今天這批的單字卡" />
        <EntryCard href="/review/vocab" icon="📖" title="できる日本語 單字" detail="初級・初中級 依課測驗" />
        <EntryCard href="/review/bank" icon="📝" title="題庫練習" detail="依冊・課・題型" />
        <EntryCard href="/review/exam" icon="🎯" title="考試複習" />
        <EntryCard href="#" icon="🈴" title="漢字" detail="HSJⅡ 漢字庫整理好後開放" disabled />
        <EntryCard href="#" icon="🔤" title="動詞の形" detail="準備中" disabled />
      </div>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">聽讀</h2>
      <EntryCard href={NHK_EASY_URL} icon="📰" title="NHK Easy" detail="聽讀 5 分" external />

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">最近的課堂筆記</h2>
      {notes.length === 0 ? (
        <p className="text-sm text-muted">讀不到課堂筆記</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {notes.map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noreferrer" className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted">{n.date ? formatJP(n.date) : ""}</span>
                <span className="min-w-0 flex-1 truncate text-sm" lang="ja">
                  {n.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{[n.level, n.lesson].filter(Boolean).join(" ")}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
