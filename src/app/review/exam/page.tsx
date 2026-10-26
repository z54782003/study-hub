import Link from "next/link";
import { EntryCard } from "@/components/EntryCard";
import { EXAMS } from "@/lib/config";
import { today } from "@/lib/data";
import { diffDays } from "@/lib/dates";
import { examLessons, sourceQuery } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "考試複習・Study Hub" };

// 現在的課程是初中級；考試範圍「1〜3課」= 初中級 L1–L3
const LEVEL = "初中級";

function examEntry(name: string, scope: string) {
  if (name.includes("漢字テスト")) return { href: "", detail: `${scope}・漢字庫建好後開放`, disabled: true };
  if (name.includes("作文")) return { href: "", detail: `${scope}・寫好給老師改`, disabled: true };
  if (name.includes("動詞の形")) return { href: "", detail: `${scope}・準備中（依單字庫活用自動出題）`, disabled: true };
  const lessons = examLessons(scope);
  if (!lessons.length) return { href: "", detail: `${scope}・沒有對應的課`, disabled: true };
  const vocab = /語彙/.test(scope);
  return {
    href: `/review/session?${sourceQuery(
      vocab
        ? { src: "vocab", lang: "ja", level: LEVEL, lessons, count: 30 }
        : { src: "bank", level: LEVEL, lessons, qtype: null, scope: "all", count: 30 },
    )}`,
    detail: `${scope}・${LEVEL} L${lessons[0]}–${lessons[lessons.length - 1]} ${vocab ? "單字" : "題庫"}`,
    disabled: false,
  };
}

export default function ExamPage() {
  const day = today();
  const upcoming = EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 30);
  return (
    <>
      <Link href="/review" className="text-sm text-muted">
        ‹ 複習
      </Link>
      <h1 className="mt-1 mb-1 text-2xl font-bold">考試複習</h1>
      <p className="mb-4 text-sm text-muted">未來 30 天的考試，點了直接開始；アチーブ的語彙範圍考單字，其他考題庫。</p>
      {upcoming.length === 0 && <p className="text-muted">這一期沒有接下來的考試了</p>}
      <div className="space-y-2.5">
        {upcoming.flatMap((e) =>
          // 「動詞の形テスト／ビジネス日本語アチーブ」這種一天兩場的拆開
          e.name.split("／").map((name, i) => {
            const scope = e.scope.split("／")[i] ?? e.scope;
            const entry = examEntry(name, scope);
            return (
              <EntryCard
                key={e.date + name}
                href={entry.href}
                icon={e.daysLeft <= 7 ? "🔔" : "🗓️"}
                title={`${e.date.slice(5).replace("-", "/")} ${name}`}
                detail={entry.detail}
                badge={e.daysLeft === 0 ? "今天" : `${e.daysLeft} 天`}
                disabled={entry.disabled}
              />
            );
          }),
        )}
      </div>
    </>
  );
}
