import { EntryCard, EntryGroup } from "@/components/EntryCard";
import { NHK_EASY_URL } from "@/lib/config";
import { recentClassNotes } from "@/lib/data";
import { formatJP } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "日文・Study Hub" };

// 日文分頁只放「學」：瀏覽單字、筆記、讀物。測驗一律從複習分頁進。
export default async function JapanesePage() {
  const notes = await recentClassNotes(6).catch(() => []);
  return (
    <>
      <h1 className="mb-4 text-[28px] leading-[34px] font-bold">日文</h1>

      <EntryGroup label="日文內容">
        <EntryCard
          inGroup
          href="/n3"
          icon="layers"
          title="N3 單字・今日文型"
          detail="今天這批的單字卡"
        />
        <EntryCard
          inGroup
          href="/ja/audio"
          icon="headphones"
          title="課文音檔"
          detail="できる日本語 初中級・全文課文＋各場面"
        />
        <EntryCard
          inGroup
          href="/ja/tadoku"
          icon="book"
          title="多読書庫"
          detail="依級數的免費讀本，記錄讀過哪些"
        />
        <EntryCard
          inGroup
          href={NHK_EASY_URL}
          icon="news"
          title="NHK Easy"
          detail="NHK 網站・在新分頁開啟"
          external
        />
        <EntryCard
          inGroup
          href="/ja/lessons"
          icon="cards"
          title="できる日本語 單字"
          detail="各課單字・熟悉度"
        />
        <EntryCard
          inGroup
          href="/ja/kanji"
          icon="kanji"
          title="漢字表"
          detail="HSJⅠ 0–9章・HSJⅡ 1–8章"
        />
        <EntryCard
          inGroup
          href="/ja/verbs"
          icon="table"
          title="動詞變化表"
          detail="11 種形・G1／G2／G3"
        />
      </EntryGroup>

      <h2 className="mt-6 mb-2 text-xl font-bold">最近的課堂筆記</h2>
      {notes.length === 0 ? (
        <p className="text-sm text-muted">讀不到課堂筆記</p>
      ) : (
        <ul className="divide-y divide-line card">
          {notes.map((n) => (
            <li key={n.id}>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline gap-3 px-4 py-2.5"
              >
                <span className="w-24 shrink-0 text-xs text-muted">
                  {n.date ? formatJP(n.date) : ""}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm" lang="ja">
                  {n.title}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {[n.level, n.lesson].filter(Boolean).join(" ")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
