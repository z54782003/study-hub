import Link from "next/link";
import { VoaReadMark } from "./VoaText";
import { getVoaFeed } from "@/lib/data";
import { VOA_FEEDS, type VoaFeedKey } from "@/lib/voa";

export const dynamic = "force-dynamic";
export const metadata = { title: "VOA 讀＋聽・Study Hub" };

export default async function VoaPage({ searchParams }: { searchParams: Promise<{ feed?: string }> }) {
  const q = await searchParams;
  const feed = VOA_FEEDS.find((f) => f.key === q.feed) ?? VOA_FEEDS[0];
  let items: Awaited<ReturnType<typeof getVoaFeed>> = [];
  let error: string | null = null;
  try {
    items = await getVoaFeed(feed.key as VoaFeedKey);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <>
      <Link href="/en" className="text-sm text-muted">
        ‹ 英文
      </Link>
      <h1 className="mt-1 text-2xl font-bold">VOA 讀＋聽</h1>
      <p className="mb-3 text-sm text-muted">慢速英文全文＋朗讀；點單字查字典、加入單字庫</p>

      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {VOA_FEEDS.map((f) => (
          <Link
            key={f.key}
            href={`/en/voa?feed=${f.key}`}
            scroll={false}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${f.key === feed.key ? "border-accent bg-accent text-white" : "border-line bg-card"}`}
          >
            {f.title}
          </Link>
        ))}
      </nav>
      <p className="mb-3 text-sm text-muted">{feed.note}</p>

      {error && <p className="text-sm text-bad">讀取失敗：{error}</p>}
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={`/en/voa/${it.id}?feed=${feed.key}`} className="block rounded-2xl border border-line bg-card px-4 py-3">
              <span className="flex items-baseline gap-2">
                <span className="flex-1 font-semibold" lang="en">
                  {it.title}
                </span>
                <VoaReadMark id={it.id} />
              </span>
              {it.description && (
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted" lang="en">
                  {it.description}
                </span>
              )}
              <span className="mt-1 block text-xs text-muted">{it.date}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 mb-4 text-xs leading-relaxed text-muted">
        內容來自 learningenglish.voanews.com（公共領域；VOA 自 2025 年 3 月起停止更新，這裡是各單元最近的文章）。
      </p>
    </>
  );
}
