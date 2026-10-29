import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";
import { englishLevelCounts, getEnglishVocab } from "@/lib/data";
import { CEFRS, sourceQuery } from "@/lib/reviewSource";
import { LessonCards } from "@/app/ja/words/LessonCards";

export const dynamic = "force-dynamic";
export const metadata = { title: "英文單字・Study Hub" };

/** 英文單字卡：選 B1／B2，再選主題（全部／日常／旅行…），一張一張看；練習時自動更新熟悉度 */
export default async function EnglishWordsPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const q = (await searchParams).level;
  const level = CEFRS.find((c) => c === q) ?? "B1";
  const [counts, groups] = await Promise.all([englishLevelCounts().catch(() => ({}) as Record<string, number>), getEnglishVocab(level)]);
  const count = groups.reduce((n, g) => n + g.words.length, 0);
  const practice = (topic?: string) => `/review/session?${sourceQuery({ src: "vocab", lang: "en", level: null, lessons: [], count: 30, cefr: level, ...(topic ? { topic } : {}) })}`;
  return (
    <>
      <BackLink href="/en">英文</BackLink>
      <h1 className="mt-1 mb-3 text-[28px] leading-[34px] font-bold">
        英文單字<span className="ml-2 text-base font-medium text-muted">{count} 個字</span>
      </h1>
      <div className="mb-3 grid grid-cols-2 gap-2" role="tablist" aria-label="等級">
        {CEFRS.map((c) => (
          <Link
            key={c}
            href={`/en/words?level=${c}`}
            role="tab"
            aria-selected={c === level}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-[14px] border font-bold ${c === level ? "border-accent bg-accent text-on-accent" : "border-line bg-card"}`}
          >
            {c}
            <span className="text-[13px] font-normal opacity-70">{counts[c] ?? 0}</span>
          </Link>
        ))}
      </div>
      {count === 0 ? (
        <StatusMessage title={`單字庫還沒有 ${level} 的英文單字`} body="在 Notion 單字庫加入英文單字並填好 CEFR 和主題後，會出現在這裡。" />
      ) : (
        <LessonCards key={level} lang="en" groups={groups} practice={practice()} sectionPractice={Object.fromEntries(groups.map((g) => [g.title, practice(g.title)]))} />
      )}
    </>
  );
}
