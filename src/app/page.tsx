import { TaskItem } from "@/components/TaskItem";
import { NHK_EASY_URL } from "@/lib/config";
import { getToday } from "@/lib/data";
import { hasNotion } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  if (!hasNotion() && process.env.MOCK !== "1") {
    return (
      <section className="mt-10 rounded-2xl border border-line bg-card p-5">
        <h1 className="text-lg font-semibold">還沒連上 Notion</h1>
        <p className="mt-2 text-sm text-muted">請在環境變數設定 NOTION_TOKEN，並把相關資料庫分享給這個 integration（見 README）。</p>
      </section>
    );
  }

  const t = await getToday();
  const reviewTotal = t.review.quiz + t.review.n3 + t.review.grammar;

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">今日 {t.dateLabel}</h1>
        {t.weekend && <span className="text-sm text-muted">週末・輕量</span>}
      </header>

      {t.exams.length > 0 && (
        <section className="mb-4 space-y-2">
          {t.exams.map((e) => (
            <div key={e.date + e.name} className="rounded-2xl bg-accent/10 px-4 py-3 text-accent">
              <div className="font-semibold">
                🔔 {e.name}・{e.daysLeft === 0 ? "今天！" : `還有 ${e.daysLeft} 天`}
              </div>
              <div className="text-sm opacity-90">{e.scope}</div>
            </div>
          ))}
        </section>
      )}

      <ul className="space-y-2.5">
        {!t.weekend && (
          <TaskItem
            date={t.date}
            id="preview"
            icon="📖"
            title={t.preview ? t.preview.title : "預習（今天的預習頁還沒產生）"}
            href={t.preview?.url}
            external
          />
        )}
        {t.n3 && (
          <TaskItem
            date={t.date}
            id="n3"
            icon="🈁"
            title={`N3 單字 ${t.n3.count} 個`}
            detail={t.n3.grammar.length ? `文型：${t.n3.grammar.map((g) => g.name).join("、")}` : undefined}
            href="/n3"
          />
        )}
        <TaskItem date={t.date} id="nhk" icon="📰" title="NHK Easy 聽讀 5 分" href={NHK_EASY_URL} external />

        {!t.weekend && (
          <li className="flex items-center gap-3 px-1 py-1 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            13:00–16:10 上課
            <span className="h-px flex-1 bg-line" />
          </li>
        )}

        {!t.weekend && (
          <TaskItem
            date={t.date}
            id="class-note"
            icon="📒"
            title={t.classNote ? "看今天的課堂筆記" : "課堂筆記（尚未建立）"}
            detail={t.classNote ? `${t.classNote.title}・${t.classNote.status ?? ""}` : undefined}
            href={t.classNote?.url}
            external
          />
        )}
        <TaskItem
          date={t.date}
          id="review"
          icon="🔁"
          title={reviewTotal ? `今晚複習 ${reviewTotal} 張` : "今晚複習：全部完成"}
          detail={reviewTotal ? `題庫 ${t.review.quiz}・N3 單字 ${t.review.n3}・文型 ${t.review.grammar}` : undefined}
          href="/review"
          autoDone={reviewTotal === 0}
        />
        <TaskItem
          date={t.date}
          id="ted"
          icon="🎧"
          title={t.ted ? `TED：${t.ted.title}` : "TED（Log 裡沒有待做的 talk）"}
          detail={t.ted ? "盲聽 → 精讀 → 回聽 → Shadowing → 輸出" : undefined}
          href={t.ted?.url}
        />
        <TaskItem
          date={t.date}
          id="reading"
          icon="📕"
          title="閱讀 30 分"
          detail={t.books.length ? t.books.map((b) => b.title).join("、") : "目前沒有 Reading 中的書"}
          href={t.books[0]?.url}
          external
        />
      </ul>

      {t.errors.length > 0 && (
        <details className="mt-6 rounded-2xl border border-bad/40 bg-card p-4 text-sm">
          <summary className="cursor-pointer text-bad">有 {t.errors.length} 個資料來源讀取失敗</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {t.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {t.errors.some((e) => /Could not find|shared|unauthorized|restricted/i.test(e)) && (
            <p className="mt-2 text-muted">看起來是該資料庫還沒分享給 Notion integration（資料庫右上角 ⋯ → Connections）。</p>
          )}
        </details>
      )}
    </>
  );
}
