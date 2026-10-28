import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { FAMILIARITY, vocabLessonStats } from "@/lib/data";
import { LESSON_COUNT, LEVELS } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "できる日本語 單字・Study Hub" };

const SHADE: Record<string, string> = {
  未學: "bg-card-2 ring-1 ring-line ring-inset",
  忘記: "bg-due",
  學習中: "bg-h2",
  熟悉: "bg-h3",
  精通: "bg-h4",
};

/** 一課的熟悉度分布：未學／忘記／學習中／熟悉／精通，寬度＝字數 */
function FamiliarityBar({ counts = {} }: { counts?: Record<string, number> }) {
  return (
    <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-[3px]" aria-hidden>
      {FAMILIARITY.filter((f) => counts[f]).map((f) => (
        <span key={f} className={SHADE[f]} style={{ flex: `${counts[f]} 0 0` }} />
      ))}
    </span>
  );
}

/** 先選初級／初中級，再選課；點課直接進單字卡 */
export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const q = (await searchParams).level;
  const level = LEVELS.find((l) => l === q) ?? null;
  const stats = await vocabLessonStats().catch(() => ({}) as Record<string, Record<string, number>>);
  const total = (k: string) => Object.values(stats[k] ?? {}).reduce((a, b) => a + b, 0);
  const lessonsOf = (lv: string) => Array.from({ length: LESSON_COUNT }, (_, i) => i + 1).filter((n) => total(`${lv} L${n}`));

  if (!level)
    return (
      <>
        <BackLink href="/ja">日文</BackLink>
        <h1 className="mt-1 mb-4 text-[28px] leading-[34px] font-bold" lang="ja">
          できる日本語 單字
        </h1>
        <ul className="grid grid-cols-2 gap-2.5">
          {LEVELS.toReversed().map((lv) => {
            const lessons = lessonsOf(lv);
            return (
              <li key={lv}>
                <Link href={`/ja/lessons?level=${encodeURIComponent(lv)}`} className="card flex min-h-24 flex-col justify-between rounded-[18px] p-4">
                  <span className="text-xl font-bold">{lv}</span>
                  <span className="text-[13px] text-muted">
                    {lessons.length ? `${lessons.length} 課・${lessons.reduce((a, n) => a + total(`${lv} L${n}`), 0)} 字` : "單字庫還沒有資料"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );

  const lessons = lessonsOf(level);
  return (
    <>
      <BackLink href="/ja/lessons">できる日本語</BackLink>
      <div className="mt-1 flex items-baseline justify-between">
        <h1 className="text-[28px] leading-[34px] font-bold">{level}</h1>
        <span className="text-xs text-muted">只顯示單字庫有資料的課</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2.5 text-[11px] text-ink-2" aria-label="熟悉度圖例">
        {FAMILIARITY.map((f) => (
          <li key={f} className="flex items-center gap-1">
            <span className={`size-2.5 rounded-[3px] ${SHADE[f]}`} />
            {f}
          </li>
        ))}
      </ul>
      {lessons.length === 0 ? (
        <p className="mt-4 text-sm text-muted">單字庫裡還沒有{level}的字。</p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-5">
          {lessons.map((n) => (
            <li key={n}>
              <Link
                href={`/ja/words?level=${encodeURIComponent(level)}&lesson=${n}`}
                aria-label={`${level} 第${n}課 ${total(`${level} L${n}`)} 字`}
                className="card flex min-h-16 flex-col justify-between gap-2 rounded-[14px] p-3"
              >
                <span className="text-[15px] font-bold">
                  第{n}課<span className="text-xs font-medium text-muted">・{total(`${level} L${n}`)} 字</span>
                </span>
                <FamiliarityBar counts={stats[`${level} L${n}`]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
