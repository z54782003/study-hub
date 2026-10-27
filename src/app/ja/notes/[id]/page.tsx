import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { getClassNote } from "@/lib/data";
import { formatJP } from "@/lib/dates";
import type { GrammarBullet, Seg } from "@/lib/noteGrammar";

export const dynamic = "force-dynamic";
export const metadata = { title: "課堂筆記・Study Hub" };

function Text({ segs }: { segs: Seg[] }) {
  return segs.map((s, i) => (s.bold ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>));
}

/** 「例」那幾條用「／」分句，一句一行 */
function splitSentences(segs: Seg[]): Seg[][] {
  const lines: Seg[][] = [[]];
  for (const s of segs)
    s.text.split("／").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines.at(-1)!.push({ ...s, text: part });
    });
  return lines.filter((l) => l.some((s) => s.text.trim()));
}

function Bullet({ b }: { b: GrammarBullet }) {
  const quiet = b.label && /逐字|出處/.test(b.label);
  return (
    <div className={quiet ? "text-[13px] text-muted" : "text-[15px] leading-relaxed"}>
      {b.label && <div className={`label ${b.label.includes("易錯") ? "text-due" : ""}`}>{b.label}</div>}
      {b.label?.startsWith("例") ? (
        <ul className="space-y-1" lang="ja">
          {splitSentences(b.segs).map((l, i) => (
            <li key={i}>
              <Text segs={l} />
            </li>
          ))}
        </ul>
      ) : (
        <p lang="ja">
          <Text segs={b.segs} />
        </p>
      )}
    </div>
  );
}

/** 課堂筆記：Notion「## 文法（全部）」底下的 ①②③ 直接在這裡看 */
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
      {note.homework && (
        <section className="mb-3 card p-4">
          <div className="label">作業</div>
          <p className="text-[15px] leading-relaxed" lang="ja">
            {note.homework}
          </p>
        </section>
      )}
      {note.grammar.length === 0 ? (
        <p className="text-sm text-muted">這份筆記沒有「文法」段落的編號項目。</p>
      ) : (
        <div className="space-y-3">
          {note.grammar.map((g) => (
            <details key={g.no} open className="card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-baseline gap-2 px-4 py-3">
                <span className="text-lg font-bold text-accent">{g.no}</span>
                <span className="text-[17px] font-bold" lang="ja">
                  {g.title}
                </span>
              </summary>
              <div className="space-y-3 border-t border-line px-4 py-3">
                {g.bullets.map((b, i) => (
                  <Bullet key={i} b={b} />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
      <a href={note.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-accent">
        在 Notion 看完整筆記 ↗
      </a>
    </div>
  );
}
