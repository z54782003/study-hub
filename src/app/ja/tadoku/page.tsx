import Link from "next/link";
import { ReadButton } from "./ReadButton";
import { getTadokuBooks, getTadokuLog, today } from "@/lib/data";
import { TADOKU_LEVELS, TADOKU_URL, type TadokuLevel } from "@/lib/tadoku";
import { BackLink } from "@/components/BackLink";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "多読書庫・Study Hub" };

export default async function TadokuPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
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
  const list = books.filter((b) => b.level === level).sort((a, b) => Number(Boolean(log[a.id])) - Number(Boolean(log[b.id])));

  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 text-[28px] leading-[34px] font-bold">多読書庫</h1>
      <p className="mb-3 text-sm text-muted">
        讀完 {readTotal} 本・這個月 {readMonth} 本
      </p>

      {error && (
        <p className="mb-3 rounded-2xl border border-bad/40 bg-card p-3 text-sm text-bad">
          書單讀取失敗：{error}。可以直接到{" "}
          <a href={TADOKU_URL} target="_blank" rel="noreferrer" className="underline">
            多読網站
          </a>
          。
        </p>
      )}

      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {stats.map((s) => (
          <Link
            key={s.level}
            href={`/ja/tadoku?level=${s.level}`}
            scroll={false}
            className={`flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-semibold whitespace-nowrap ${s.level === level ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
          >
            {s.level === "Start" ? "入門" : `L${s.level}`}・{s.read}/{s.total}
          </Link>
        ))}
      </nav>

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
                  <span className="mt-0.5 block text-xs text-muted">
                    {[...b.tags, read?.date ? `${read.date.slice(5).replace("-", "/")} 讀完` : null].filter(Boolean).join("・")}
                  </span>
                </span>
              </Link>
              <ReadButton id={b.id} initial={Boolean(read)} />
            </li>
          );
        })}
      </ul>

      <p className="mt-6 mb-4 text-xs leading-relaxed text-muted">
        書單來自 NPO 多言語多読「無料の読みもの」（CC BY-NC-ND 4.0）。點書名在 app 裡看影片版（書頁＋朗讀）或只聽朗讀；內容都來自多読網站，未經修改。
      </p>
    </>
  );
}
