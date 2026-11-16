import { ClassCard } from "@/components/ClassCard";
import { Icon, type IconName } from "@/components/Icon";
import { TaskList, type Task, type TaskRow } from "@/components/TaskList";
import { COUNTDOWN, EXAMS, NHK_EASY_URL } from "@/lib/config";
import { sourceQuery } from "@/lib/reviewSource";
import { stageFor } from "@/lib/stages";
import type { CalendarEvent } from "@/lib/calendar";
import Link from "next/link";
import { getToday, today } from "@/lib/data";
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

/** ?d=YYYY-MM-DD：從「紀錄」點進來看過去某一天的今日內容 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  if (!hasNotion() && process.env.MOCK !== "1") {
    return (
      <section className="mt-10 card p-5">
        <h1 className="text-lg font-semibold">還沒連上 Notion</h1>
        <p className="mt-2 text-sm text-muted">請在環境變數設定 NOTION_TOKEN，並把相關資料庫分享給這個 integration（見 README）。</p>
      </section>
    );
  }

  const d0 = (await searchParams).d;
  const t = await getToday(d0 && /^\d{4}-\d{2}-\d{2}$/.test(d0) && d0 < today() ? d0 : undefined);
  const dayWord = t.past ? "這天" : "今天";
  const reviewTotal = t.review.quiz + t.review.n3 + t.review.grammar;
  const [, m, d] = t.date.split("-").map(Number);
  // 倒數：左＝最近一場學校考試，右＝N3 單字背完
  const exam = EXAMS.map((e) => ({ ...e, daysLeft: diffDays(t.date, e.date) })).find((e) => e.daysLeft >= 0);
  const countdownDays = diffDays(t.date, COUNTDOWN.date);

  const stage = stageFor(t.date);
  // 下一場考試（今天以後）：期末衝刺的必做是「看課堂筆記＋隔天考試範圍」
  const nextExam = EXAMS.map((e) => ({ ...e, daysLeft: diffDays(t.date, e.date) })).find((e) => e.daysLeft >= 1);
  // 寒假清債：初級單字測驗一天一課，L1→L15 輪流
  const beginnerLesson = (Math.max(diffDays(stage.start, t.date), 0) % 15) + 1;
  const school = stage.school && !t.weekend;

  const tasks: Record<string, Task | null> = {
    "class-note": school
      ? {
          id: "class-note",
          title: "看今天的課堂筆記",
          sub: t.classNote ? `${t.classNote.title}${t.classNote.status ? `・${t.classNote.status}` : ""}` : "下課後（尚未建立）",
          href: t.classNote?.url,
          external: true,
        }
      : null,
    exam: nextExam
      ? {
          id: "exam",
          title: "準備下一場考試",
          sub: `${daysText(nextExam.daysLeft)} ${formatJP(nextExam.date)}・${nextExam.name}（${nextExam.scope}）`,
          href: "/review/exam",
        }
      : null,
    "beginner-vocab":
      stage.mustTasks.includes("beginner-vocab")
        ? {
            id: "beginner-vocab",
            title: `初級單字測驗 L${beginnerLesson}`,
            sub: "一天一課，L1–L15 輪流",
            href: `/review/session?${sourceQuery({ src: "vocab", lang: "ja", level: "初級", lessons: [beginnerLesson], count: 50 })}`,
          }
        : null,
    "n2-grammar": stage.mustTasks.includes("n2-grammar") ? { id: "n2-grammar", title: "N2 文法 1 個", sub: "N2 文法資料還沒建立" } : null,
    preview: school ? { id: "preview", title: "預習", sub: t.preview ? t.preview.title : "今天的預習頁還沒產生", href: t.preview?.url, external: true } : null,
    n3: t.n3
      ? { id: "n3", title: `N3 單字 ${t.n3.count} 個`, sub: t.n3.grammar.length ? `文型：${t.n3.grammar.map((g) => g.name).join("、")}` : "今日批次", href: t.past ? undefined : "/n3" }
      : null,
    // 過去的日子：到期複習、TED、閱讀只剩打勾紀錄（內容是「現在」的狀態，看不到當天的）
    review: t.past
      ? { id: "review", title: stage.quiz === "debt" ? "題庫錯題 20 題" : "到期複習", sub: "看這天的作答紀錄", href: `/history?m=${t.date.slice(0, 7)}&d=${t.date}` }
      : {
          id: "review",
          title: stage.quiz === "debt" ? (reviewTotal ? "題庫錯題 20 題" : "題庫錯題：今天的做完了") : reviewTotal ? "今日到期複習" : "今日到期：全部完成",
          sub: reviewTotal
            ? [`題庫 ${t.review.quiz}`, t.review.n3 && `N3 單字 ${t.review.n3}`, t.review.grammar && `文型 ${t.review.grammar}`].filter(Boolean).join("・")
            : undefined,
          tag: reviewTotal ? `${reviewTotal} 張` : undefined,
          href: "/review/due",
          autoDone: reviewTotal === 0,
        },
    nhk: { id: "nhk", title: "NHK Easy 5 分", sub: "NHK 網站", href: NHK_EASY_URL, external: true },
    ted: t.past ? { id: "ted", title: "TED" } : { id: "ted", title: "TED", sub: t.ted ? t.ted.title : "Log 裡沒有待做的 talk", href: t.ted?.url },
    reading: t.past
      ? { id: "reading", title: "閱讀 30 分" }
      : {
          id: "reading",
          title: "閱讀 30 分",
          sub: t.books.length ? t.books.map((b) => b.title).join("、") : "目前沒有 Reading 中的書",
          href: t.books[0]?.url,
          external: !!t.books[0],
        },
  };
  // 每個階段只有一件必做（stage.mustTasks），其他照這個順序放「有空再做」
  const ORDER = ["class-note", "exam", "beginner-vocab", "n2-grammar", "n3", "preview", "review", "nhk", "ted", "reading"];
  const pick = (ids: string[]) => ids.flatMap((id) => (tasks[id] ? [tasks[id]] : []));
  const mustRows: TaskRow[] = pick(stage.mustTasks);
  // 上課那條分隔線放在「看今天的課堂筆記」前面
  const classAt = mustRows.findIndex((r) => typeof r !== "string" && r.id === "class-note");
  if (classAt >= 0) mustRows.splice(classAt, 0, "13:00–16:10 上課");
  const optionalRows = pick(ORDER.filter((id) => !stage.mustTasks.includes(id)));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-x-5 md:[grid-auto-flow:dense]">
      <header className="flex items-end justify-between md:col-span-2">
        <div>
          {t.past && (
            <Link href={`/history?m=${t.date.slice(0, 7)}&d=${t.date}`} className="mb-1 inline-flex items-center gap-0.5 text-sm font-semibold text-accent">
              <Icon name="back" size={16} stroke={2.2} />
              紀錄
            </Link>
          )}
          <div className="text-[13px] font-medium text-muted">
            {m}月{d}日 星期{WEEKDAY[new Date(`${t.date}T00:00:00Z`).getUTCDay()]}
            ・{stage.name}
            {t.weekend && "・週末輕量"}
          </div>
          <h1 className="mt-0.5 text-[28px] leading-[34px] font-bold">{t.past ? "這天要做的事" : "今天要做的事"}</h1>
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
          <div className="text-xs font-bold text-ink-2">{COUNTDOWN.name}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] leading-9 font-bold tabular-nums">{countdownDays}</span>
            <span className="text-sm font-semibold text-ink-2">天</span>
          </div>
          <div className="text-[13px] text-ink-2">{formatJP(COUNTDOWN.date)}</div>
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

      {/* iPad：今天的課固定在右欄（寒假沒課就不顯示） */}
      {school && (
        <section aria-label={`${dayWord}的課`} className="card space-y-2.5 p-4 md:sticky md:top-4 md:col-start-2 md:row-span-6 md:row-start-2">
          <Heading
            icon="cap"
            title={`${dayWord}的課`}
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
            <Heading icon="calendar" title={`${dayWord}的行程`} />
            <span className="ml-auto text-sm text-muted">還沒連結行事曆</span>
          </div>
        ) : t.calendar.length > 0 ? (
          <div className="space-y-2">
            <Heading icon="calendar" title={`${dayWord}的行程`} />
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
            <Heading icon="calendar" title={`${dayWord}的行程`} />
            <span className="ml-auto text-sm text-muted">{dayWord}沒有行程</span>
          </div>
        )}
      </section>

      <div className="md:col-start-1">
        <TaskList
          date={t.date}
          groups={[
            { title: "必做", rows: mustRows },
            { title: "有空再做", rows: optionalRows },
          ]}
        />
      </div>

      {t.errors.length > 0 && (
        <details className="card p-4 text-sm md:col-span-2">
          <summary className="cursor-pointer font-bold text-bad">有 {t.errors.length} 個資料來源讀取失敗</summary>
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
