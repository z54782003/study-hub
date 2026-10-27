import { notFound } from "next/navigation";
import { VoaDone, VoaText } from "../VoaText";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Speak } from "@/components/Speak";
import { getVoaArticle } from "@/lib/data";
import { VOA_BASE } from "@/lib/voa";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "VOA・Study Hub" };

export default async function VoaArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ feed?: string }> }) {
  const { id } = await params;
  const { feed } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  let a: Awaited<ReturnType<typeof getVoaArticle>> | null = null;
  let error: string | null = null;
  try {
    a = await getVoaArticle(id);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const source = `${VOA_BASE}/a/${id}.html`;
  return (
    <>
      <BackLink href={`/en/voa${feed ? `?feed=${feed}` : ""}`}>VOA</BackLink>
      {error || !a ? (
        <p className="mt-4 text-bad">
          讀取失敗：{error}。
          <a href={source} target="_blank" rel="noreferrer" className="underline">
            到 VOA 網站看
          </a>
        </p>
      ) : (
        <>
          <div className="mt-1 mb-3 flex items-start justify-between gap-3">
            <h1 className="read text-[26px] leading-tight font-bold" lang="en">
              {a.title}
            </h1>
            <VoaDone id={id} />
          </div>
          {a.audio ? (
            <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-bg px-4 pt-[env(safe-area-inset-top)] pb-2.5">
              <AudioPlayer src={a.audio} />
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">這篇沒有音檔</p>
          )}
          <VoaText paragraphs={a.paragraphs} />

          {a.words.length > 0 && (
            <section className="card mt-6 px-4 py-3.5">
              <h2 className="label mb-1" lang="en">
                Words in This Story
              </h2>
              <ul lang="en">
                {a.words.map((w) => (
                  <li key={w.term} className="flex items-start gap-1 border-t border-line py-1.5">
                    <span className="read flex-1 pt-2 text-[15px] leading-normal">
                      <b>{w.term}</b> – {w.def}
                    </span>
                    <Speak text={w.term} lang="en" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-6 mb-4 text-xs leading-relaxed text-muted">
            {a.credit.join(" ")}{" "}
            <a href={source} target="_blank" rel="noreferrer" className="underline">
              VOA Learning English
            </a>
          </p>
        </>
      )}
    </>
  );
}
