import { labelItem, parseClassTitle, splitLesson, splitNumbered, type NoteItem } from "@/lib/classNote";
import type { TodayData } from "@/lib/types";
import { Icon } from "./Icon";

const SHOWN = 5;
// 連絡、テスト予告加底色（不只靠顏色：前面有文字標籤）
const KIND_STYLE: Record<NoteItem["kind"], string> = {
  exam: "bg-exam-soft",
  notice: "bg-accent-soft",
  homework: "",
  normal: "",
};
const KIND_MARK: Record<NoteItem["kind"], [string, string] | null> = {
  exam: ["テスト", "text-exam"],
  notice: ["連絡", "text-accent"],
  homework: null,
  normal: null,
};

type Numbered = NoteItem & { n: number };

function NoteList({ items }: { items: NoteItem[] }) {
  // n＝筆記裡原本的編號（排序後仍顯示原編號）
  const row = (it: Numbered) => (
    <li key={it.n} className={`flex gap-2.5 rounded-xl px-2 py-1.5 ${KIND_STYLE[it.kind]}`}>
      {KIND_MARK[it.kind] ? (
        <span className={`mt-0.5 shrink-0 text-xs font-bold ${KIND_MARK[it.kind]![1]}`}>{it.label ?? KIND_MARK[it.kind]![0]}</span>
      ) : (
        <span className="mt-0.5 w-5 shrink-0 text-center text-xs tabular-nums text-muted">{it.n}</span>
      )}
      <span className="min-w-0 text-sm leading-relaxed" lang="ja">
        {it.label && !KIND_MARK[it.kind] && <span className="mr-1.5 font-semibold">{it.label}</span>}
        {it.body}
      </span>
    </li>
  );
  // 考試、連絡放最前面，其他照上課順序
  const numbered = items.map((it, i) => ({ ...it, n: i + 1 }));
  const important = numbered.filter((it) => it.kind === "exam" || it.kind === "notice");
  const rest = numbered.filter((it) => it.kind !== "exam" && it.kind !== "notice");
  const ordered = [...important, ...rest];
  const head = ordered.slice(0, SHOWN);
  const tail = ordered.slice(SHOWN);
  return (
    <>
      <ol className="-mx-2 space-y-0.5">{head.map(row)}</ol>
      {tail.length > 0 && (
        <details className="group">
          <summary className="mt-1 cursor-pointer list-none text-xs text-accent group-open:hidden">展開其餘 {tail.length} 項</summary>
          <ol className="-mx-2 space-y-0.5">{tail.map(row)}</ol>
        </details>
      )}
    </>
  );
}

function Homework({ text }: { text: string }) {
  const { items, note } = splitNumbered(text);
  return (
    <div className="mt-3 rounded-xl border border-line px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Icon name="pencil" size={18} className="text-muted" />作業</div>
      <ul className="space-y-1 text-sm leading-relaxed" lang="ja">
        {items.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted">・</span>
            <span className="min-w-0">{h}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

/** 文法區標題：「L3 全課文法快速複習（今天沒有新文法…）」照原文顯示；一般新課顯示「今天的文法」 */
function grammarHeading(title: string | null): string {
  if (!title || /^文法點?解說/.test(title)) return "今天的文法";
  return title;
}

/** 今日頁「今天的課」：下課後顯示課堂筆記，課前顯示預習頁 */
export function ClassCard({ classNote, preview }: Pick<TodayData, "classNote" | "preview">) {
  if (classNote?.summary) {
    const t = parseClassTitle(classNote.title);
    const { items } = splitNumbered(classNote.summary);
    return (
      <>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {t.lesson && <span className="tag shrink-0 bg-ink text-bg">{t.lesson}</span>}
          <span className="font-semibold" lang="ja">
            {t.topic}
          </span>
          {t.pages && <span className="text-xs text-muted">{t.pages}</span>}
        </div>
        {t.points.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {t.points.map((p) => (
              <li key={p} className="rounded-full border border-line px-2.5 py-0.5 text-xs" lang="ja">
                {p}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <NoteList items={items.map(labelItem)} />
        </div>
        {classNote.homework && <Homework text={classNote.homework} />}
      </>
    );
  }
  if (preview) {
    const lesson = preview.lesson ? splitLesson(preview.lesson) : null;
    return (
      <>
        <div className="flex items-baseline gap-2">
          <span className="tag shrink-0 bg-accent-soft text-accent">預習</span>
          <span className="text-[15px] leading-snug font-bold" lang="ja">
            {lesson?.main ?? preview.title}
          </span>
        </div>
        {lesson?.detail && (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted" lang="ja">
            {lesson.detail}
          </p>
        )}
        {preview.grammar.length > 0 && (
          <>
            <div className="label mt-3 mb-1.5">{grammarHeading(preview.grammarTitle)}</div>
            <ol className="space-y-1.5">
              {preview.grammar.map((g, i) => {
                const [ja, zh] = g.split("\t");
                return (
                  <li key={g} className="flex gap-1.5">
                    <span className="shrink-0 font-semibold text-accent">{"①②③④⑤⑥⑦⑧⑨⑩"[i] ?? `${i + 1}.`}</span>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold" lang="ja">
                        {ja.replace(/^[①-⑳\d.、．]+\s*/, "")}
                      </span>
                      {zh && <span className="block text-[13px] text-ink-2">{zh}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        {preview.grammarNote && (
          <details className="mt-2 rounded-xl bg-card-2 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-ink-2">易混淆整理</summary>
            <p className="mt-1 leading-relaxed" lang="ja">
              {preview.grammarNote.replace(/^易混淆總?整理[：:]\s*/, "")}
            </p>
          </details>
        )}
        {preview.exam && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-exam-soft px-3 py-2.5 text-sm font-bold text-exam" lang="ja">
            <Icon name="bell" size={18} stroke={2} className="shrink-0" />
            {preview.exam}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">下課後整理好筆記，這裡會換成課堂重點和作業</p>
      </>
    );
  }
  return <p className="text-sm text-muted">今天的預習頁和課堂筆記都還沒產生</p>;
}
