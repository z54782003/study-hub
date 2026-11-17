import Link from "next/link";
import { getGoals, getHistoryView, today } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { MonthSwipe } from "./MonthSwipe";
import { formatJP } from "@/lib/dates";
import { paceText } from "@/lib/goals";
import { level, monthGrid, shiftMonth, streak, weekSummary } from "@/lib/history";

export const dynamic = "force-dynamic";
export const metadata = { title: "紀錄・Study Hub" };

const SHADES = ["bg-card-2", "bg-h1", "bg-h2", "bg-h3", "bg-h4"];
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const pctOf = (ok: number, n: number) => (n ? Math.round((ok / n) * 100) : 0);

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ d?: string; m?: string; k?: string }> }) {
  const q = await searchParams;
  const now = today();
  const thisMonth = now.slice(0, 7);
  const month = q.m && /^\d{4}-\d{2}$/.test(q.m) && q.m <= thisMonth ? q.m : thisMonth;
  const selected = q.d && /^\d{4}-\d{2}-\d{2}$/.test(q.d) && q.d <= now ? q.d : month === thisMonth ? now : `${month}-01`;
  // 月曆只要每天的統計（過去的有快取）；作答內容只讀選的那一天
  const [{ stats, dayItems }, goals] = await Promise.all([getHistoryView(month, selected), getGoals()]);

  const counts: Record<string, number> = {};
  for (const [d, s] of Object.entries(stats)) counts[d] = s.n;
  const grid = monthGrid(month, now, counts);
  const week = weekSummary(now, stats);
  const lastWeek = weekSummary(now, stats, 1);
  const weakest = week.kinds.find((k) => k.pct < 80);
  const selectedStat = stats[selected] ?? { n: dayItems.length, ok: dayItems.filter((a) => a.correct).length, kinds: {} };
  const byKind = Object.entries(
    dayItems.reduce<Record<string, { n: number; ok: number }>>((m, a) => {
      const k = (m[a.kind || "其他"] ??= { n: 0, ok: 0 });
      k.n++;
      if (a.correct) k.ok++;
      return m;
    }, {}),
  );
  const kind = byKind.some(([k]) => k === q.k) ? q.k : null;
  const wrong = dayItems.filter((a) => !a.correct && (!kind || (a.kind || "其他") === kind));
  const url = (p: { m?: string; d?: string; k?: string | null }) => {
    const sp = new URLSearchParams({ m: p.m ?? month, d: p.d ?? selected });
    if (p.k) sp.set("k", p.k);
    return `/history?${sp}`;
  };
  const prev = url({ m: shiftMonth(month, -1), d: `${shiftMonth(month, -1)}-01` });
  const next = month < thisMonth ? url({ m: shiftMonth(month, 1), d: `${shiftMonth(month, 1)}-01` }) : null;
  const [y, mo] = month.split("-").map(Number);

  return (
    <>
      <h1 className="mb-4 text-[28px] leading-[34px] font-bold">紀錄</h1>

      <section className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "連續天數", value: `${streak(now, counts)} 天` },
          { label: "這週作答", value: `${week.n} 題` },
          { label: "這週正確率", value: week.n ? `${pctOf(week.ok, week.n)}%` : "—" },
        ].map((s) => (
          <div key={s.label} className="card py-3">
            <div className="text-xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <section aria-label="這週回顧" className="card mb-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">這週回顧</h2>
          <span className="text-xs text-muted tabular-nums">
            讀了 {week.studied} 天・上週 {lastWeek.studied} 天 {lastWeek.n} 題
          </span>
        </div>
        <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label={`這週讀了 ${week.studied} 天`}>
          {week.days.map((d, i) => (
            <li key={d.day} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-muted">
              <span
                className={`grid size-8 place-items-center rounded-full ${d.done ? "bg-ok text-card" : d.future ? "border border-dashed border-line" : "bg-card-2"} ${d.day === now ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`}
              >
                {d.done && <Icon name="check" size={16} stroke={3} label="有作答" />}
              </span>
              {WEEKDAYS[i]}
            </li>
          ))}
        </ol>
        {week.kinds.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            {week.kinds.map((k) => (
              <li key={k.kind} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate font-semibold">{k.kind}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-2">
                  <span className={`block h-full rounded-full ${k.pct < 80 ? "bg-due" : "bg-ok"}`} style={{ width: `${k.pct}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right text-xs text-ink-2 tabular-nums">
                  {k.pct}%・{k.n} 題
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[13px] text-ink-2">
          {week.n === 0
            ? "這週還沒有作答。"
            : weakest
              ? `這週最弱的是「${weakest.kind}」（${weakest.pct}%），下週先補這一類。`
              : "這週各類型都在 80% 以上。"}
        </p>
      </section>

      <section aria-label="本季目標" className="card mb-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">本季目標</h2>
          <span className="text-xs text-muted">{goals.quarter.period}・到 {formatJP(goals.quarter.end)}</span>
        </div>
        {goals.error ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            讀不到 Life Planner 的 Goals。請在 Notion 的 Goals 資料庫加上這個 integration 的連線（右上角 ⋯ → Connections）。
            <span className="mt-1 block text-xs text-muted">{goals.error}</span>
          </p>
        ) : goals.goals.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-2">Goals 裡沒有這一季（{goals.quarter.period}）日文、英文的關鍵結果。</p>
        ) : (
          <ul className="mt-3 space-y-3.5">
            {goals.goals.map((g) => {
              const pace = paceText(g.current, g.target, goals.quarter, now);
              return (
                <li key={g.id}>
                  <a href={g.url} target="_blank" rel="noreferrer" className="block">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 text-sm font-semibold">{g.name}</span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {g.current}
                        <span className="font-medium text-muted"> / {g.target}</span>
                      </span>
                    </span>
                    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-card-2">
                      <span className={`block h-full rounded-full ${pace.behind ? "bg-due" : "bg-ok"}`} style={{ width: `${g.target ? Math.min((g.current / g.target) * 100, 100) : 0}%` }} />
                    </span>
                    <span className="mt-1 flex justify-between text-xs">
                      <span className={pace.behind ? "font-semibold text-due" : "text-ok"}>{pace.text}</span>
                      <span className="text-muted">{g.auto ? "App 自動計算，寫回 Notion" : "照 Notion 填的數字"}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mb-5 p-4">
        <div className="mb-3 flex items-center">
          <Link href={prev} scroll={false} aria-label="上個月" className="grid size-11 place-items-center text-accent">
            <Icon name="back" stroke={2.2} />
          </Link>
          <h2 className="flex-1 text-center text-[17px] font-bold tabular-nums">
            {y} 年 {mo} 月
          </h2>
          {next ? (
            <Link href={next} scroll={false} aria-label="下個月" className="grid size-11 place-items-center text-accent">
              <Icon name="chevron" stroke={2.2} />
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </div>
        <MonthSwipe prev={prev} next={next}>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {grid.flat().map((c, i) =>
              !c ? (
                <span key={i} />
              ) : c.future ? (
                <span key={c.day} className="grid aspect-square place-items-center rounded-lg text-[13px] text-muted/60 tabular-nums">
                  {Number(c.day.slice(8))}
                </span>
              ) : (
                <Link
                  key={c.day}
                  href={url({ d: c.day })}
                  scroll={false}
                  aria-label={`${c.day} ${c.count} 題`}
                  aria-current={c.day === selected ? "date" : undefined}
                  className={`grid aspect-square place-items-center rounded-lg text-[13px] font-semibold tabular-nums ${SHADES[level(c.count)]} ${
                    level(c.count) >= 4 ? "text-on-accent" : "text-ink"
                  } ${c.day === selected ? "ring-2 ring-ink ring-offset-1 ring-offset-card" : ""} ${c.day === now ? "underline underline-offset-2" : ""}`}
                >
                  {Number(c.day.slice(8))}
                </Link>
              ),
            )}
          </div>
        </MonthSwipe>
        <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-muted">
          0
          {SHADES.map((s) => (
            <span key={s} className={`size-3 rounded-[3px] ${s}`} />
          ))}
          40+ 題
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">
          {formatJP(selected)}
          <span className="ml-2 text-sm font-normal text-muted">
            {dayItems.length ? `${dayItems.length} 題・正確率 ${pctOf(selectedStat.ok, selectedStat.n)}%` : "這天沒有作答"}
          </span>
        </h2>
        <Link href={selected === now ? "/" : `/?d=${selected}`} className="card mb-3 flex min-h-12 items-center gap-2.5 px-4 text-sm font-semibold">
          <Icon name="sun" className="shrink-0 text-muted" />
          {selected === now ? "看今天要做的事" : "看這天要做的事"}
          <Icon name="chevron" size={16} stroke={2.2} className="ml-auto text-muted" />
        </Link>
        {byKind.length > 0 && (
          <nav aria-label="類型" className="mb-3 flex flex-wrap gap-1.5">
            <Link
              href={url({ k: null })}
              scroll={false}
              className={`flex h-9 items-center rounded-full border px-3 text-sm font-semibold ${!kind ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
            >
              全部
            </Link>
            {byKind.map(([k, v]) => (
              <Link
                key={k}
                href={url({ k })}
                scroll={false}
                className={`flex h-9 items-center rounded-full border px-3 text-sm font-semibold ${kind === k ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
              >
                {k} <span className="ml-1 tabular-nums opacity-70">{v.ok}/{v.n}</span>
              </Link>
            ))}
          </nav>
        )}
        {dayItems.length > 0 && wrong.length === 0 && <p className="text-sm text-muted">{kind ? `${kind}沒有錯題` : "這天沒有錯題"}</p>}
        {wrong.length > 0 && (
          <ul className="card divide-y divide-line overflow-hidden">
            {wrong.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="tag mr-2 bg-card-2 text-ink-2">{a.kind}</span>
                    <span lang="ja">{a.title}</span>
                    {a.answer && (
                      <span className="mt-1 block text-bad" lang="ja">
                        ✗ {a.answer}
                      </span>
                    )}
                    {a.reference && (
                      <span className="block text-ok" lang="ja">
                        ✓ {a.reference}
                      </span>
                    )}
                  </span>
                  <Icon name="external" size={16} stroke={2} className="mt-0.5 shrink-0 text-muted" label="在 Notion 開啟" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
