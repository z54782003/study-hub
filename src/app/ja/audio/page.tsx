import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { StatusMessage } from "@/components/StatusMessage";
import { getLessonAudio } from "@/lib/data";
import { LESSON_PLANS } from "@/lib/lessonAudio";
import { LessonAudioView } from "./LessonAudioView";

export const dynamic = "force-dynamic";
export const metadata = { title: "課文音檔・Study Hub" };

const LESSONS = LESSON_PLANS.map((p) => p.n);

export default async function LessonAudioPage({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const q = await searchParams;
  const n = LESSONS.find((l) => String(l) === q.l) ?? 1;
  const lesson = await getLessonAudio(n).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
  const plan = LESSON_PLANS.find((p) => p.n === n);

  return (
    <>
      <BackLink href="/ja">日文</BackLink>
      <h1 className="mt-1 text-[28px] leading-[34px] font-bold">課文音檔</h1>
      <p className="mb-3 text-sm text-muted" lang="ja">
        できる日本語 初中級
      </p>

      <nav aria-label="課" className="mb-4 grid grid-cols-8 gap-1">
        {LESSONS.map((l) => (
          <Link
            key={l}
            href={`/ja/audio?l=${l}`}
            scroll={false}
            aria-current={l === n ? "page" : undefined}
            className={`grid h-11 place-items-center rounded-xl border text-[15px] font-bold ${l === n ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink-2"}`}
          >
            {l}
          </Link>
        ))}
      </nav>

      {lesson instanceof Error ? (
        <StatusMessage tone="error" title="讀不到課文音檔" body={`Notion 回應：${lesson.message}`} />
      ) : (
        <>
          <h2 className="mb-3 text-xl font-bold" lang="ja">
            第{n}課{lesson.title && `　${lesson.title}`}
          </h2>
          <LessonAudioView tracks={lesson.tracks} transcript={lesson.transcript} st={plan?.st ?? null} />
        </>
      )}
    </>
  );
}
