import { EntryCard } from "@/components/EntryCard";
import { Icon } from "@/components/Icon";
import { getEnglishHub } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "英文・Study Hub" };

export default async function EnglishPage() {
  const h = await getEnglishHub();
  // 進度：今天做／待做 之外的都當作做完了
  const current = h.ted.filter((t) => !t.progress || t.progress === "今天做" || t.progress === "待做");
  const done = h.ted.length - current.length;
  return (
    <>
      <h1 className="mb-4 text-[28px] leading-[34px] font-bold">英文</h1>

      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Icon name="headphones" className="text-muted" />TED</h2>
      {current.length === 0 ? (
        <p className="text-sm text-muted">TED Log 裡沒有待做的 talk</p>
      ) : (
        <div className="space-y-2.5">
          {current.slice(0, 6).map((t) => (
            <EntryCard key={t.id} href={`/ted/${t.id}`} icon="play" title={t.title} detail={t.progress ?? undefined} />
          ))}
        </div>
      )}
      {done > 0 && <p className="mt-2 text-xs text-muted">已完成 {done} 個 talk</p>}

      <h2 className="mt-6 mb-2 flex items-center gap-2 text-lg font-bold"><Icon name="news" className="text-muted" />讀＋聽</h2>
      <EntryCard href="/en/voa" icon="news" title="VOA Learning English" detail="慢速英文全文＋朗讀，點字查、加入單字庫" />

      <h2 className="mt-6 mb-2 flex items-center gap-2 text-lg font-bold"><Icon name="book" className="text-muted" />閱讀中</h2>
      {h.books.length === 0 ? (
        <p className="text-sm text-muted">目前沒有 Reading 中的書</p>
      ) : (
        <div className="space-y-2.5">
          {h.books.map((b) => (
            <EntryCard key={b.url} href={b.url} icon="book" title={b.title} detail={b.type ?? undefined} external />
          ))}
        </div>
      )}

      {h.errors.length > 0 && <p className="mt-6 text-xs text-bad">{h.errors.join("；")}</p>}
    </>
  );
}
