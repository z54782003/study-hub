import { EntryCard } from "@/components/EntryCard";
import { EXAMS } from "@/lib/config";
import { today } from "@/lib/data";
import { diffDays } from "@/lib/dates";
import { examChapters, examLessons, sourceQuery } from "@/lib/reviewSource";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "考試複習・Study Hub" };

// 動詞の形テストの範圍 → 練習的形
const VERB_EXAM_FORMS: [string, string[]][] = [
  ["可能", ["可能"]],
  ["意向", ["意向"]],
  ["尊敬", ["尊敬"]],
  ["条件", ["條件"]],
  ["受身", ["受身"]],
  ["命令", ["命令"]],
  ["禁止", ["禁止"]],
];

// 現在的課程是初中級；考試範圍「1〜3課」= 初中級 L1–L3
const LEVEL = "初中級";

type Entry = { label: string; href: string; detail: string; disabled: boolean };

/** 一場考試的入口（「動詞の形テスト／ビジネス」這種一天兩場的各自一個） */
function examEntries(name: string, scope: string): Entry[] {
  if (name.includes("漢字テスト")) {
    const chapters = examChapters(scope);
    return chapters.length
      ? [{ label: "", href: `/review/session?${sourceQuery({ src: "kanji", chapters, count: 50 })}`, detail: `${scope}・漢字卡`, disabled: false }]
      : [{ label: "", href: "", detail: `${scope}・沒有對應的章`, disabled: true }];
  }
  if (name.includes("作文")) return [{ label: "", href: "", detail: `${scope}・寫好給老師改`, disabled: true }];
  if (name.includes("動詞の形")) {
    const forms = VERB_EXAM_FORMS.filter(([k]) => scope.includes(k)).flatMap(([, f]) => f);
    return forms.length
      ? [{ label: "", href: `/review/session?${sourceQuery({ src: "verb", forms, groups: [], judge: true, count: 30 })}`, detail: `${scope}・動詞の形 30 題`, disabled: false }]
      : [{ label: "", href: "", detail: `${scope}・沒有對應的形`, disabled: true }];
  }
  const lessons = examLessons(scope);
  if (!lessons.length) return [{ label: "", href: "", detail: `${scope}・沒有對應的課`, disabled: true }];
  const range = `${LEVEL} L${lessons[0]}–${lessons[lessons.length - 1]}`;
  // 「語彙・文法」：點進去再選語彙題或文法題（單字卡在「單字・漢字」）；讀解・聽解這類直接出整個題庫
  if (/語彙|文法/.test(scope))
    return [{ label: "", href: `/review/exam/bank?${new URLSearchParams({ lessons: lessons.join(","), title: `${name}（${scope}）` })}`, detail: `${range} 題庫・選語彙題或文法題`, disabled: false }];
  return [
    {
      label: "",
      href: `/review/session?${sourceQuery({ src: "bank", level: LEVEL, lessons, qtype: null, scope: "all", count: 30 })}`,
      detail: `${range} 題庫`,
      disabled: false,
    },
  ];
}

export default function ExamPage() {
  const day = today();
  const upcoming = EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 30);
  return (
    <>
      <BackLink href="/review">複習</BackLink>
      <h1 className="mt-1 mb-1 text-[28px] leading-[34px] font-bold">考試複習</h1>
      <p className="mb-4 text-sm text-muted">未來 30 天的考試；アチーブ的「語彙・文法」點進去選語彙題或文法題，其他點了直接開始。單字卡在「單字・漢字」。</p>
      {upcoming.length === 0 && <p className="text-muted">這一期沒有接下來的考試了</p>}
      <div className="space-y-2.5">
        {upcoming.flatMap((e) =>
          // 「動詞の形テスト／ビジネス日本語アチーブ」這種一天兩場的拆開
          e.name.split("／").flatMap((name, i) => {
            const scope = e.scope.split("／")[i] ?? e.scope;
            return examEntries(name, scope).map((entry) => (
              <EntryCard
                key={e.date + name + entry.label}
                href={entry.href}
                icon={e.daysLeft <= 7 ? "bell" : "calendar"}
                tone={e.daysLeft <= 7 ? "exam" : "accent"}
                title={`${e.date.slice(5).replace("-", "/")} ${name}${entry.label ? `・${entry.label}` : ""}`}
                detail={entry.detail}
                badge={e.daysLeft === 0 ? "今天" : `${e.daysLeft} 天`}
                disabled={entry.disabled}
              />
            ));
          }),
        )}
      </div>
    </>
  );
}
