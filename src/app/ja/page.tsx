import Link from "next/link";
import { EntryCard } from "@/components/EntryCard";
import { NHK_EASY_URL } from "@/lib/config";
import { recentClassNotes, vocabLessonCounts } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import { LESSON_COUNT, LEVELS } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "日文・Study Hub" };

// 日文分頁只放「學」：瀏覽單字、筆記、讀物。測驗一律從複習分頁進。
export default async function JapanesePage() {
  const [notes, counts] = await Promise.all([recentClassNotes(6).catch(() => []), vocabLessonCounts().catch(() => ({}) as Record<string, number>)]);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">日文</h1>

      <div className="space-y-2.5">
        <EntryCard href="/n3" icon="🈁" title="N3 單字・今日文型" detail="今天這批的單字卡" />
        <EntryCard href="/ja/tadoku" icon="📚" title="多読書庫" detail="依級數的免費讀本，記錄讀過哪些" />
        <EntryCard href={NHK_EASY_URL} icon="📰" title="NHK Easy" detail="聽讀 5 分（NHK 網站）" external />
        <EntryCard href="/ja/kanji" icon="🈴" title="漢字表" detail="HSJⅠ・Ⅱ 依章：音訓、意思、例詞" />
        <EntryCard href="/ja/verbs" icon="🔤" title="動詞變化表" detail="ます・ない・て・可能・意向・條件・受身・命令・尊敬" />
      </div>

      {LEVELS.map((level) => {
        const lessons = Array.from({ length: LESSON_COUNT }, (_, i) => i + 1).filter((n) => counts[`${level} L${n}`]);
        if (!lessons.length) return null;
        return (
          <section key={level}>
            <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">できる日本語 {level}・單字</h2>
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {lessons.map((n) => (
                <li key={n}>
                  <Link
                    href={`/ja/words?level=${encodeURIComponent(level)}&lesson=${n}`}
                    className="flex flex-col items-center rounded-2xl border border-line bg-card py-2.5"
                  >
                    <span className="font-semibold">第{n}課</span>
                    <span className="text-xs text-muted">{counts[`${level} L${n}`]} 字</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

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
