import { EntryCard } from "@/components/EntryCard";
import { EXAMS } from "@/lib/config";
import { getMistakes, getReviewQueue, today } from "@/lib/data";
import { diffDays } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "複習・Study Hub" };

export default async function ReviewHub() {
  const [queue, mistakes] = await Promise.all([getReviewQueue().catch(() => null), getMistakes().catch(() => null)]);
  const day = today();
  const nextExam = EXAMS.find((e) => diffDays(day, e.date) >= 0);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">複習</h1>
      <div className="space-y-2.5">
        <EntryCard
          href="/review/due"
          icon="🔁"
          title="今日到期"
          detail="題庫到期題＋N3 單字＋今日文型"
          badge={queue === null ? "?" : queue.length || "✓"}
        />
        <EntryCard
          href="/review/exam"
          icon="🎯"
          title="考試複習"
          detail={nextExam ? `下一場：${nextExam.date.slice(5).replace("-", "/")} ${nextExam.name}（${nextExam.scope}）` : "依考試範圍出題"}
        />
        <EntryCard href="/review/bank" icon="📝" title="題庫練習" detail="選 初級／初中級・課・題型" />
        <EntryCard href="/review/vocab" icon="🈁" title="單字測驗" detail="できる日本語 每課單字" />
      </div>
      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">錯題</h2>
      <EntryCard
        href="/mistakes"
        icon="📌"
        title="錯題區"
        detail="上次答錯的題目，可以整批重測"
        badge={mistakes === null ? "?" : mistakes.length}
      />
    </>
  );
}
