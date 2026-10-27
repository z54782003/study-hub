import { ClassCard } from "@/components/ClassCard";
import { Icon, type IconName } from "@/components/Icon";
import { TaskList, type TaskRow } from "@/components/TaskList";
import { EXAMS, JLPT, NHK_EASY_URL } from "@/lib/config";
import type { CalendarEvent } from "@/lib/calendar";
import { getToday } from "@/lib/data";
import { diffDays, formatJP } from "@/lib/dates";
import { hasNotion } from "@/lib/notion";

export const dynamic = "force-dynamic";

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const daysText = (n: number) => (n === 0 ? "今天" : n === 1 ? "明天" : `${n} 天後`);

function Heading({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[15px] font-bold">
      <Icon name={icon} className="text-muted" />
      {title}
      {right && <span className="ml-auto text-xs font-medium text-muted">{right}</span>}
    </div>
  );
}

function EventList({ events }: { events: CalendarEvent[] }) {
  return (
    <ul className="divide-y divide-line">
      {events.map((e, i) => (
        <li key={i} className="flex gap-3 py-2 first:pt-0 last:pb-0">
          <span className="w-24 shrink-0 text-sm tabular-nums text-muted">{e.allDay ? "全天" : `${e.start}–${e.end}`}</span>
          <span className="min-w-0">
            <span className="font-medium">{e.title}</span>
            {e.location && <span className="block truncate text-xs text-muted">{e.location}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function TodayPage() {
  if (!hasNotion() && process.env.MOCK !== "1") {
    return (
      <section className="mt-10 card p-5">
        <h1 className="text-lg font-semibold">還沒連上 Notion</h1>
        <p className="mt-2 text-sm text-muted">請在環境變數設定 NOTION_TOKEN，並把相關資料庫分享給這個 integration（見 README）。</p>
      </section>
    );
  }

  const t = await getToday();
  const reviewTotal = t.review.quiz + t.review.n3 + t.review.grammar;
  const [, m, d] = t.date.split("-").map(Number);
  // 倒數：左＝最近一場學校考試，右＝JLPT
  const exam = EXAMS.map((e) => ({ ...e, daysLeft: diffDays(t.date, e.date) })).find((e) => e.daysLeft >= 0);
  const jlptDays = diffDays(t.date, JLPT.date);

  const rows: TaskRow[] = [
    ...(!t.weekend
      ? [{ id: "preview", title: "預習", sub: t.preview ? t.preview.title : "今天的預習頁還沒產生", href: t.preview?.url, external: true }]
      : []),
    ...(t.n3
      ? [{ id: "n3", title: `N3 單字 ${t.n3.count} 個`, sub: t.n3.grammar.length ? `文型：${t.n3.grammar.map((g) => g.name).join("、")}` : "今日批次", href: "/n3" }]
      : []),
    { id: "nhk", title: "NHK Easy 5 分", sub: "NHK 網站", href: NHK_EASY_URL, external: true },
    ...(!t.weekend ? ["13:00–16:10 上課"] : []),
    ...(!t.weekend
      ? [
          {
            id: "class-note",
            title: "看今天的課堂筆記",
            sub: t.classNote ? `${t.classNote.title}${t.classNote.status ? `・${t.classNote.status}` : ""}` : "下課後（尚未建立）",
            href: t.classNote?.url,
            external: true,
          },
        ]
      : []),
    {
      id: "review",
      title: reviewTotal ? "今日到期複習" : "今日到期：全部完成",
      sub: reviewTotal ? `題庫 ${t.review.quiz}・N3 單字 ${t.review.n3}・文型 ${t.review.grammar}` : undefined,
      tag: reviewTotal ? `${reviewTotal} 張` : undefined,
      href: "/review/due",
      autoDone: reviewTotal === 0,
    },
    { id: "ted", title: "TED", sub: t.ted ? t.ted.title : "Log 裡沒有待做的 talk", href: t.ted?.url },
    {
      id: "reading",
      title: "閱讀 30 分",
      sub: t.books.length ? t.books.map((b) => b.title).join("、") : "目前沒有 Reading 中的書",
      href: t.books[0]?.url,
      external: !!t.books[0],
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-x-5 md:[grid-auto-flow:dense]">
      <header className="flex items-end justify-between md:col-span-2">
        <div>
          <div className="text-[13px] font-medium text-muted">
            {m}月{d}日 星期{WEEKDAY[new Date(`${t.date}T00:00:00Z`).getUTCDay()]}
            {t.weekend && "・週末輕量"}
          </div>
          <h1 className="mt-0.5 text-[28px] leading-[34px] font-bold">今天要做的事</h1>
        </div>
      </header>

      <section aria-label="考試倒數" className="grid grid-cols-[1.25fr_1fr] gap-2.5 md:col-start-1">
        {exam ? (
          <a href="/review/exam" className="block rounded-2xl bg-exam-soft px-3.5 py-3 text-exam">
            <div className="text-xs font-bold">{exam.date.slice(5).replace("-", "/")} 學校考試</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] leading-9 font-bold tabular-nums">{exam.daysLeft === 0 ? "今天" : exam.daysLeft}</span>
              {exam.daysLeft > 0 && <span className="text-sm font-semibold">天</span>}
            </div>
            <div className="truncate text-[13px] font-semibold text-ink" lang="ja">
              {exam.name}・{exam.scope}
            </div>
          </a>
        ) : (
          <div className="card rounded-2xl px-3.5 py-3 text-sm text-muted">這一期沒有接下來的考試</div>
        )}
        <div className="card rounded-2xl px-3.5 py-3">
          <div className="text-xs font-bold text-ink-2">{JLPT.name}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] leading-9 font-bold tabular-nums">{jlptDays}</span>
            <span className="text-sm font-semibold text-ink-2">天</span>
          </div>
          <div className="text-[13px] text-ink-2">{JLPT.date.replaceAll("-", "/")}（日）</div>
        </div>
      </section>

      {/* 提醒：7 天內的考試（今天以外）與作業截止 */}
      <div className="space-y-2 empty:hidden md:col-start-1">
      {t.exams
        .filter((e) => !(exam && e.date === exam.date && e.name === exam.name))
        .map((e) => (
          <a key={e.date + e.name} href="/review/exam" className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-exam-soft px-3.5 py-2">
            <Icon name="bell" className="shrink-0 text-exam" />
            <span className="text-[13px] font-bold whitespace-nowrap text-exam">考試・{daysText(e.daysLeft)}</span>
            <span className="min-w-0 truncate text-sm font-semibold" lang="ja">
              {e.name}（{e.scope}）
            </span>
          </a>
        ))}
      {t.homework.map((h) => (
        <a key={h.url + h.due} href={h.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-due-soft px-3.5 py-2">
          <Icon name="pencil" className="shrink-0 text-due" />
          <span className="text-[13px] font-bold whitespace-nowrap text-due">作業・{h.daysLeft === 0 ? "今天截止" : `${daysText(h.daysLeft)}截止`}</span>
          <span className="min-w-0 truncate text-sm font-semibold" lang="ja">
            {h.text}
          </span>
        </a>
      ))}
      </div>

      {/* iPad：今天的課固定在右欄 */}
      {!t.weekend && (
        <section aria-label="今天的課" className="card space-y-2.5 p-4 md:sticky md:top-4 md:col-start-2 md:row-span-6 md:row-start-2">
          <Heading
            icon="cap"
            title="今天的課"
            right={
              (t.classNote?.url ?? t.preview?.url) && (
                <a href={t.classNote?.url ?? t.preview?.url} target="_blank" rel="noreferrer" className="text-accent">
                  {t.classNote?.summary ? "課堂筆記" : "預習頁"} ↗
                </a>
              )
            }
          />
          <ClassCard classNote={t.classNote} preview={t.preview} />
        </section>
      )}

      <section aria-label="行程" className="card px-4 py-3.5 md:col-start-1">
        {t.calendar === null ? (
          <div className="flex items-center gap-2.5">
            <Heading icon="calendar" title="今天的行程" />
            <span className="ml-auto text-sm text-muted">還沒連結行事曆</span>
          </div>
        ) : t.calendar.length > 0 ? (
          <div className="space-y-2">
            <Heading icon="calendar" title="今天的行程" />
            <EventList events={t.calendar} />
          </div>
        ) : t.nextCalendar ? (
          <div className="space-y-2">
            <Heading
              icon="calendar"
              title="下一個行程"
              right={`今天沒有・${daysText(diffDays(t.date, t.nextCalendar.date))} ${formatJP(t.nextCalendar.date)}`}
            />
            <EventList events={t.nextCalendar.events} />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Heading icon="calendar" title="今天的行程" />
            <span className="ml-auto text-sm text-muted">今天沒有行程</span>
          </div>
        )}
      </section>

      <div className="md:col-start-1">
        <TaskList date={t.date} rows={rows} />
      </div>

      {t.errors.length > 0 && (
        <details className="card p-4 text-sm md:col-span-2">
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
    </div>
  );
}
