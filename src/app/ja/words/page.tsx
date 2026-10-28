import { getLessonVocab } from "@/lib/data";
import { LEVELS } from "@/lib/reviewSource";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";
import { LessonCards } from "./LessonCards";

export const dynamic = "force-dynamic";
export const metadata = { title: "單字・Study Hub" };

export default async function LessonWordsPage({ searchParams }: { searchParams: Promise<{ level?: string; lesson?: string }> }) {
  const q = await searchParams;
  const level = LEVELS.find((l) => l === q.level) ?? "初中級";
  const lesson = Math.max(1, Math.min(15, Number(q.lesson) || 1));
  const groups = await getLessonVocab(level, lesson);
  const count = groups.reduce((n, g) => n + g.words.length, 0);
  const practice = `/review/words?${new URLSearchParams({ level, lessons: String(lesson) })}`;
  return (
    <>
      <BackLink href={`/ja/lessons?level=${encodeURIComponent(level)}`}>{level}</BackLink>
      <h1 className="mt-1 mb-3 text-[28px] leading-[34px] font-bold">
        第{lesson}課<span className="ml-2 text-base font-medium text-muted">{count} 個字</span>
      </h1>
      {count === 0 ? (
        <StatusMessage title="這課在單字庫裡還沒有字" body="在 Notion 單字庫加入這課的字（填好「課次」）後，會出現在這裡。" />
      ) : (
        <LessonCards key={`${level}-${lesson}`} groups={groups} practice={practice} />
      )}
    </>
  );
}
