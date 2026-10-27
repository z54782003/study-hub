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
      <h1 className="mb-4 text-[28px] leading-[34px] font-bold">複習</h1>
      <div className="space-y-2.5">
        <EntryCard
          href="/review/due"
          icon="repeat"
          tone="due"
          title="今日到期"
          detail={queue?.length === 0 ? "今天到期的都做完了" : "題庫到期題＋N3 單字＋今日文型"}
          badge={queue === null ? "?" : queue.length}
          disabled={queue?.length === 0}
        />
        <EntryCard href="/review/words" icon="cards" title="單字・漢字" detail="日文依課・英文・漢字依章｜寫讀音和意思，AI 批改" />
        <EntryCard href="/review/questions" icon="pencil" title="題目練習" detail="題庫・動詞の形｜寫答案批改" />
        <EntryCard
          href="/review/exam"
          icon="target"
          tone="exam"
          title="考試複習"
          detail={nextExam ? `下一場：${nextExam.date.slice(5).replace("-", "/")} ${nextExam.name}（${nextExam.scope}）` : "依考試範圍出題"}
        />
      </div>
      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">錯題</h2>
      <EntryCard
        href="/mistakes"
        icon="pin"
        tone="bad"
        title="錯題區"
        detail={mistakes?.length === 0 ? "目前沒有錯題" : "答對一次就移出，可以整批重測"}
        badge={mistakes === null ? "?" : mistakes.length}
        disabled={mistakes?.length === 0}
      />
    </>
  );
}
