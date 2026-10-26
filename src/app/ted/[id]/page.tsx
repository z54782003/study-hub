import { TedPlayer } from "@/components/player/TedPlayer";
import { getTedLogEntry } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "TED・Study Hub" };

export default async function TedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getTedLogEntry(id);
  if (!entry.link)
    return (
      <div className="mt-10 space-y-3">
        <p className="font-semibold">TED Log 這筆「{entry.title}」沒有填「連結」</p>
        <p className="text-sm text-muted">在 Notion 填上 ted.com 的網址後重新整理即可。</p>
        <a href={entry.notionUrl} target="_blank" rel="noreferrer" className="text-accent">
          打開 Notion ↗
        </a>
      </div>
    );
  return <TedPlayer tedUrl={entry.link} title={entry.title} notionUrl={entry.notionUrl} />;
}
