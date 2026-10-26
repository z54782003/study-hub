import Link from "next/link";
import { getHistory } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import { heatmap, level, streak } from "@/lib/history";

export const dynamic = "force-dynamic";
export const metadata = { title: "紀錄・Study Hub" };

const WEEKS = 12;
const SHADES = ["bg-line", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { today, attempts } = await getHistory(WEEKS * 7);
  const { d } = await searchParams;
  const selected = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;

  const counts: Record<string, number> = {};
  for (const a of attempts) counts[a.day] = (counts[a.day] ?? 0) + 1;
  const grid = heatmap(today, counts, WEEKS);
  const thisWeek = new Set(grid.at(-1)!.map((c) => c.day));
  const week = attempts.filter((a) => thisWeek.has(a.day));
  const pct = (xs: typeof attempts) => (xs.length ? Math.round((xs.filter((a) => a.correct).length / xs.length) * 100) : 0);
  const dayItems = attempts.filter((a) => a.day === selected);
  const byKind = Object.entries(
    dayItems.reduce<Record<string, { n: number; ok: number }>>((m, a) => {
      const k = (m[a.kind || "其他"] ??= { n: 0, ok: 0 });
      k.n++;
      if (a.correct) k.ok++;
      return m;
    }, {}),
  );
  const wrong = dayItems.filter((a) => !a.correct);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">紀錄</h1>

      <section className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "連續天數", value: `${streak(today, counts)} 天` },
          { label: "這週作答", value: `${week.length} 題` },
          { label: "這週正確率", value: week.length ? `${pct(week)}%` : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card py-3">
            <div className="text-xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="mb-5 rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">最近 {WEEKS} 週</h2>
        <div className="flex gap-1">
          <div className="mr-1 grid grid-rows-7 gap-1 text-[10px] leading-none text-muted">
            {["一", "", "三", "", "五", "", "日"].map((w, i) => (
              <span key={i} className="flex h-full items-center">
                {w}
              </span>
            ))}
          </div>
          {grid.map((col) => (
            <div key={col[0].day} className="grid flex-1 grid-rows-7 gap-1">
              {col.map((c) =>
                c.future ? (
                  <span key={c.day} className="aspect-square" />
                ) : (
                  <Link
                    key={c.day}
                    href={`/history?d=${c.day}`}
                    scroll={false}
                    aria-label={`${c.day} ${c.count} 題`}
                    className={`aspect-square rounded-[3px] ${SHADES[level(c.count)]} ${c.day === selected ? "ring-2 ring-ink" : ""}`}
                  />
                ),
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">點格子看那一天</p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">
          {formatJP(selected)}
          <span className="ml-2 text-sm font-normal text-muted">
            {dayItems.length ? `${dayItems.length} 題・正確率 ${pct(dayItems)}%` : "這天沒有作答"}
          </span>
        </h2>
        {byKind.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2 text-sm">
            {byKind.map(([k, v]) => (
              <li key={k} className="rounded-full border border-line bg-card px-3 py-1">
                {k} {v.ok}/{v.n}
              </li>
            ))}
          </ul>
        )}
        {wrong.length > 0 && (
          <ul className="space-y-2">
            {wrong.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-line bg-card px-3 py-2 text-sm">
                  <span className="mr-2 text-xs text-muted">{a.kind}</span>
                  <span lang="ja">{a.title}</span>
                  {a.answer && (
                    <span className="block text-bad" lang="ja">
                      ✗ {a.answer}
                    </span>
                  )}
                  {a.reference && (
                    <span className="block text-ok" lang="ja">
                      ✓ {a.reference}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
