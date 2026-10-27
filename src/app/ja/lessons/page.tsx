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
    <span
      className="flex h-1.5 gap-0.5 overflow-hidden rounded-[3px]"
      aria-hidden
    >
      {FAMILIARITY.filter((f) => counts[f]).map((f) => (
        <span
          key={f}
          className={SHADE[f]}
          style={{ flex: `${counts[f]} 0 0` }}
        />
      ))}
    </span>
  );
}

export default async function LessonsPage() {
  const stats = await vocabLessonStats().catch(
    () => ({}) as Record<string, Record<string, number>>,
  );
  const total = (k: string) =>
    Object.values(stats[k] ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <div className="mt-1 flex items-baseline justify-between">
        <h1 className="text-[28px] leading-[34px] font-bold" lang="ja">
          できる日本語
        </h1>
        <span className="text-xs text-muted">只顯示單字庫有資料的課</span>
      </div>
      <ul
        className="mt-2 flex flex-wrap gap-2.5 text-[11px] text-ink-2"
        aria-label="熟悉度圖例"
      >
        {FAMILIARITY.map((f) => (
          <li key={f} className="flex items-center gap-1">
            <span className={`size-2.5 rounded-[3px] ${SHADE[f]}`} />
            {f}
          </li>
        ))}
      </ul>
      {LEVELS.toReversed().map((level) => {
        const lessons = Array.from(
          { length: LESSON_COUNT },
          (_, i) => i + 1,
        ).filter((n) => total(`${level} L${n}`));
        if (!lessons.length) return null;
        return (
          <section key={level}>
            <h2 className="label mt-4 mb-2">{level}</h2>
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {lessons.map((n) => (
                <li key={n}>
                  <Link
                    href={`/ja/words?level=${encodeURIComponent(level)}&lesson=${n}`}
                    aria-label={`${level} 第${n}課 ${total(`${level} L${n}`)} 字`}
                    className="card flex min-h-16 flex-col justify-between gap-2 rounded-[14px] p-3"
                  >
                    <span className="text-[15px] font-bold">
                      第{n}課
                      <span className="text-xs font-medium text-muted">
                        ・{total(`${level} L${n}`)} 字
                      </span>
                    </span>
                    <FamiliarityBar counts={stats[`${level} L${n}`]} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
