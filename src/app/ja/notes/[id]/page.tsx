import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { getClassNote } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import { keyPoints, type GrammarPoint, type Seg } from "@/lib/noteGrammar";

export const dynamic = "force-dynamic";
export const metadata = { title: "課堂筆記・Study Hub" };

function Text({ segs }: { segs: Seg[] }) {
  return segs.map((s, i) => (s.bold ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>));
}

/** 一行就一段，多行就條列 */
function List({ lines }: { lines: Seg[][] }) {
  return lines.length === 1 ? (
    <p lang="ja">
      <Text segs={lines[0]} />
    </p>
  ) : (
    <ul className="list-disc space-y-1 pl-5" lang="ja">
      {lines.map((l, i) => (
        <li key={i}>
          <Text segs={l} />
        </li>
      ))}
    </ul>
  );
}

/** short：只放重點（筆記的粗體），完整內容收在「看完整」 */
function Lines({ label, lines, warn, short }: { label: string; lines: Seg[][]; warn?: boolean; short?: boolean }) {
  if (!lines.length) return null;
  const key = short ? keyPoints(lines) : lines;
  return (
    <div className="text-[15px] leading-relaxed">
      <div className={`label ${warn ? "text-due" : ""}`}>{label}</div>
      <List lines={key} />
      {key !== lines && (
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent">
            <span className="group-open:hidden">看完整 ▾</span>
            <span className="hidden group-open:inline">收起 ▴</span>
          </summary>
          <div className="mt-1 text-[14px] text-ink-2">
            <List lines={lines} />
          </div>
        </details>
      )}
    </div>
  );
}

function Point({ g }: { g: GrammarPoint }) {
  return (
    <details open className="card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 px-4 py-3">
        <span className="text-lg font-bold text-accent">{g.no}</span>
        <span className="text-[17px] font-bold" lang="ja">
          {g.title}
        </span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-3">
        <Lines label="句型" lines={g.pattern} />
        <Lines label="說明" lines={g.explain} short />
        {g.examples.length > 0 && (
          <div className="text-[15px] leading-relaxed">
            <div className="label">例句</div>
            <ol className="space-y-1.5">
              {g.examples.map((e, i) => (
                <li key={i}>
                  <p lang="ja">
                    <Text segs={e.ja} />
                  </p>
                  {e.note && <p className="text-[13px] text-muted">{e.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
        <Lines label="⚠️ 易錯" lines={g.mistakes} warn short />
      </div>
    </details>
  );
}

/** 課堂筆記：Notion「## 文法」底下每個 ①②③ 的句型・說明・兩個例句・易錯；筆記一改就跟著更新 */
export default async function ClassNotePage({ params }: { params: Promise<{ id: string }> }) {
  const note = await getClassNote((await params).id);
  if (!note) notFound();
  return (
    <div className="mb-24">
      <BackLink href="/ja">日文</BackLink>
      <div className="mt-1 text-[13px] text-muted">{[note.date && formatJP(note.date), note.level, note.lesson].filter(Boolean).join("・")}</div>
      <h1 className="mt-0.5 mb-3 text-xl leading-snug font-bold" lang="ja">
        {note.title.replace(/^\s*\d{1,2}\/\d{1,2}（.）\s*/, "")}
      </h1>
      {note.grammar.length === 0 ? (
        <p className="text-sm text-muted">這份筆記沒有「文法」段落的編號項目。</p>
      ) : (
        <div className="space-y-3">
          {note.grammar.map((g) => (
            <Point key={g.no} g={g} />
          ))}
        </div>
      )}
      <a href={note.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-accent">
        在 Notion 看完整筆記 ↗
      </a>
    </div>
  );
}
