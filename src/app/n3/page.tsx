import { N3Cards } from "./N3Cards";
import { getN3Batch, today } from "@/lib/data";
import { formatJP } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "N3 單字・Study Hub" };

export default async function N3Page() {
  const { words, grammar } = await getN3Batch();
  return (
    <>
      <h1 className="mb-1 text-[28px] leading-[34px] font-bold">N3 單字 {formatJP(today())}</h1>
      <p className="mb-4 text-sm text-muted">今天這批 {words.length} 個（只看不考；晚上的複習會抽 10 個考）</p>
      {grammar.map((g) => (
        <section key={g.id} className="mb-4 card p-4">
          <div className="text-xs text-muted">今日文型</div>
          <div className="mt-1 text-xl font-bold" lang="ja">{g.pattern}</div>
          <div className="mt-1">{g.meaning}</div>
          {g.connection && <div className="mt-1 text-sm text-muted">接續：<span lang="ja">{g.connection}</span></div>}
          {g.confusable && <div className="text-sm text-muted">易混淆：<span lang="ja">{g.confusable}</span></div>}
        </section>
      ))}
      <N3Cards words={words} />
    </>
  );
}
