import { Ruby } from "@/components/Ruby";
import { glossParts } from "@/lib/usage";

/** 「・⚠️」提醒：「相關：」那種把日文和括號裡的中文補充分開顏色，其他（多半是中文說明）照原樣 */
export function UsageNote({ text }: { text: string }) {
  const rel = text.match(/^(相關|語源)[：:]\s*(.+)$/);
  if (!rel) return <>⚠️ <Ruby text={text} /></>;
  // 「相關：歩道（ほどう）：人行道」第二個「：」後面是中文翻譯，跟括號裡的中文一樣用淡色（發音也不念這段）
  const zh = rel[1] === "相關" ? rel[2].match(/^(.+?)\s*[：:]\s*(.+)$/) : null;
  return (
    <>
      <span className="tag mr-2 bg-card-2 text-ink-2">{rel[1]}</span>
      {glossParts(zh ? zh[1] : rel[2]).map((p, i) =>
        p.zh ? (
          <span key={i} className="text-sm text-muted">
            {p.text}
          </span>
        ) : (
          <span key={i} className="text-[15px] font-semibold text-ink" lang="ja">
            <Ruby text={p.text} />
          </span>
        ),
      )}
      {zh && <span className="ml-2 text-sm text-muted">{zh[2]}</span>}
    </>
  );
}
