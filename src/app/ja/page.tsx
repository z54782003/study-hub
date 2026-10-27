import Link from "next/link";
import { EntryCard, EntryGroup } from "@/components/EntryCard";
import { NHK_EASY_URL } from "@/lib/config";
import { FAMILIARITY, recentClassNotes, vocabLessonStats } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import { LESSON_COUNT, LEVELS } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "日文・Study Hub" };

// 日文分頁只放「學」：瀏覽單字、筆記、讀物。測驗一律從複習分頁進。
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

export default async function JapanesePage() {
  const [notes, stats] = await Promise.all([
    recentClassNotes(6).catch(() => []),
    vocabLessonStats().catch(() => ({}) as Record<string, Record<string, number>>),
  ]);
  const total = (k: string) => Object.values(stats[k] ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <h1 className="mb-4 text-[28px] leading-[34px] font-bold">日文</h1>

      <EntryGroup label="日文內容">
        <EntryCard inGroup href="/n3" icon="layers" title="N3 單字・今日文型" detail="今天這批的單字卡" />
        <EntryCard inGroup href="/ja/tadoku" icon="book" title="多読書庫" detail="依級數的免費讀本，記錄讀過哪些" />
        <EntryCard inGroup href={NHK_EASY_URL} icon="news" title="NHK Easy" detail="NHK 網站・在新分頁開啟" external />
        <EntryCard inGroup href="/ja/kanji" icon="kanji" title="漢字表" detail="HSJⅠ 0–9章・HSJⅡ 1–8章" />
        <EntryCard inGroup href="/ja/verbs" icon="table" title="動詞變化表" detail="11 種形・G1／G2／G3" />
      </EntryGroup>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-xl font-bold" lang="ja">
          できる日本語
        </h2>
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
      {LEVELS.toReversed().map((level) => {
        const lessons = Array.from({ length: LESSON_COUNT }, (_, i) => i + 1).filter((n) => total(`${level} L${n}`));
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
                      第{n}課<span className="text-xs font-medium text-muted">・{total(`${level} L${n}`)} 字</span>
                    </span>
                    <FamiliarityBar counts={stats[`${level} L${n}`]} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h2 className="mt-6 mb-2 text-xl font-bold">最近的課堂筆記</h2>
      {notes.length === 0 ? (
        <p className="text-sm text-muted">讀不到課堂筆記</p>
      ) : (
        <ul className="divide-y divide-line card">
          {notes.map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noreferrer" className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted">{n.date ? formatJP(n.date) : ""}</span>
                <span className="min-w-0 flex-1 truncate text-sm" lang="ja">
                  {n.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{[n.level, n.lesson].filter(Boolean).join(" ")}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
