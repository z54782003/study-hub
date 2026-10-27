import Link from "next/link";
import { ReadButton } from "./ReadButton";
import { getTadokuBooks, getTadokuLog, today } from "@/lib/data";
import { TADOKU_LEVELS, TADOKU_URL, type TadokuLevel } from "@/lib/tadoku";
import { BackLink } from "@/components/BackLink";
import { Icon } from "@/components/Icon";
import { StatusMessage } from "@/components/StatusMessage";

export const dynamic = "force-dynamic";
export const metadata = { title: "多読書庫・Study Hub" };

// 多読書單的標籤：「朗読音声付き」＝有朗讀 mp3（沒有的書頁會寫「朗読音声は準備中です」）
const hasAudio = (tags: string[]) => tags.some((t) => /朗読音声/.test(t));

export default async function TadokuPage({ searchParams }: { searchParams: Promise<{ level?: string; audio?: string }> }) {
  const q = await searchParams;
  let books: Awaited<ReturnType<typeof getTadokuBooks>> = [];
  let error: string | null = null;
  try {
    books = await getTadokuBooks();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const log = await getTadokuLog().catch(() => ({}) as Awaited<ReturnType<typeof getTadokuLog>>);
  const month = today().slice(0, 7);
  const readTotal = Object.keys(log).length;
  const readMonth = Object.values(log).filter((r) => r.date?.startsWith(month)).length;

  const stats = TADOKU_LEVELS.map((l) => {
    const inLevel = books.filter((b) => b.level === l);
    return { level: l, total: inLevel.length, read: inLevel.filter((b) => log[b.id]).length };
  }).filter((s) => s.total);
  // 預設：還有沒讀過的最低級
  const level: TadokuLevel =
    (TADOKU_LEVELS as readonly string[]).includes(q.level ?? "") ? (q.level as TadokuLevel) : (stats.find((s) => s.read < s.total)?.level ?? "Start");
  const audioOnly = q.audio === "1";
  const list = books.filter((b) => b.level === level && (!audioOnly || hasAudio(b.tags))).sort((a, b) => Number(Boolean(log[a.id])) - Number(Boolean(log[b.id])));

  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 text-[28px] leading-[34px] font-bold">多読書庫</h1>
      <p className="mb-3 text-sm text-muted">
        讀完 {readTotal} 本・這個月 {readMonth} 本
      </p>

      {error && (
        <StatusMessage
          tone="error"
          className="mb-3"
          title="書單讀取失敗"
          body={`可以先到原網站看書單。（原因：${error}）`}
          action={{ label: "到多読網站", href: TADOKU_URL, external: true }}
        />
      )}

      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {stats.map((s) => (
          <Link
            key={s.level}
            href={`/ja/tadoku?level=${s.level}${audioOnly ? "&audio=1" : ""}`}
            scroll={false}
            className={`flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${s.level === level ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
          >
            {s.level === "Start" ? "入門" : `L${s.level}`}・{s.read}/{s.total}
          </Link>
        ))}
      </nav>
      <Link
        href={`/ja/tadoku?level=${level}${audioOnly ? "" : "&audio=1"}`}
        scroll={false}
        aria-pressed={audioOnly}
        className={`mb-3 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${audioOnly ? "border-accent-soft bg-accent-soft text-accent" : "border-line bg-card text-ink-2"}`}
      >
        <Icon name="headphones" size={16} />
        只看有朗讀的
      </Link>

      <ul className="space-y-2.5">
        {list.map((b) => {
          const read = log[b.id];
          return (
            <li key={b.id} className={`flex items-center gap-3 card p-2.5 ${read ? "opacity-70" : ""}`}>
              <Link href={`/ja/tadoku/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-card-2 text-muted">
                  <Icon name="book" />
                </span>
                )}
                <span className="min-w-0">
                  <span className="block font-semibold" lang="ja">
                    {b.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {hasAudio(b.tags) ? (
                      <span className="tag inline-flex items-center gap-1 bg-accent-soft text-accent">
                        <Icon name="headphones" size={12} stroke={2.2} />
                        有朗讀
                      </span>
                    ) : (
                      <span className="tag bg-card-2 text-muted">朗讀準備中</span>
                    )}
                    {read?.date && <span>{read.date.slice(5).replace("-", "/")} 讀完</span>}
                  </span>
                </span>
              </Link>
              <ReadButton id={b.id} initial={Boolean(read)} />
            </li>
          );
        })}
      </ul>

      <p className="mt-6 mb-4 text-xs leading-relaxed text-muted">
        書單來自 NPO 多言語多読「無料の読みもの」（CC BY-NC-ND 4.0）。點書名在 app 裡直接讀 PDF；標「有朗讀」的書可以邊看邊聽；內容都來自多読網站，未經修改。
      </p>
    </>
  );
}
