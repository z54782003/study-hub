import { Speak } from "@/components/Speak";
import { Ruby } from "@/components/Ruby";
import type { N3Detail } from "@/lib/n3Detail";

/** 例句：單字／文型標粗；讀音（平假名）小字；中文 */
function Examples({ list, mark }: { list: N3Detail["examples"]; mark: string }) {
  return (
    <section className="space-y-3">
      <div className="label">例句</div>
      {list.map((e, i) => (
        <div key={i} className="flex items-start">
          <div className="flex-1 space-y-0.5">
            <p className="pt-1.5 text-[17px] leading-loose" lang="ja">
              <Ruby text={e.ja} word={mark} />
            </p>
            {e.kana && <p className="text-[13px] text-muted" lang="ja">{e.kana}</p>}
            {e.zh && <p className="text-sm text-ink-2">{e.zh}</p>}
          </div>
          <Speak text={e.ja} label={`播放例句${i + 1}`} />
        </div>
      ))}
    </section>
  );
}

/** N3 單字・文型・漢字共用的「📘 詳解」內容；mark＝例句裡要標出來的字 */
export function DetailBody({ d, mark }: { d: N3Detail; mark: string }) {
  return (
    <>
      {d.usage && (
        <section className="space-y-1.5">
          <div className="label">用法</div>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{d.usage}</p>
        </section>
      )}
      {d.forms.length > 0 && (
        <section className="space-y-1.5">
          <div className="label">接續</div>
          <ul className="space-y-1 text-[15px]" lang="ja">
            {d.forms.map((f, k) => <li key={k}><Ruby text={f} /></li>)}
          </ul>
        </section>
      )}
      {d.collocations.length > 0 && (
        <section className="space-y-1.5">
          <div className="label">常用搭配</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[15px] leading-relaxed">
            {d.collocations.map((c, k) => (
              <div key={k} className="contents">
                <dt className="font-semibold" lang="ja"><Ruby text={c.ja} /></dt>
                <dd className="text-ink-2">{c.zh}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {d.examples.length > 0 && <Examples list={d.examples} mark={mark} />}
      {d.compare && (
        <section className="space-y-1.5">
          <div className="label">比較</div>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{d.compare}</p>
        </section>
      )}
    </>
  );
}

