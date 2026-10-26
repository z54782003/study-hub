import Link from "next/link";
import { PracticeForm, type PracticePreset } from "./PracticeForm";
import { englishVocabCount, noteLessons, vocabLessonCounts } from "@/lib/data";
import { LEVELS, parseLessons } from "@/lib/reviewSource";

export const dynamic = "force-dynamic";
export const metadata = { title: "自選練習・Study Hub" };

// ?type=vocab&level=初中級&lessons=3 這種網址用來從日文分頁「練習這課」帶條件過來
export default async function PracticePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const preset: PracticePreset = {
    type: q.type === "vocab" ? "vocab" : "bank",
    lang: q.lang === "en" ? "en" : "ja",
    level: LEVELS.find((l) => l === q.level) ?? "初中級",
    lessons: parseLessons(q.lessons ?? null),
  };
  const [lessons, counts, english] = await Promise.all([noteLessons(), vocabLessonCounts(), englishVocabCount().catch(() => 0)]);
  return (
    <>
      <Link href="/review" className="text-sm text-muted">
        ‹ 複習
      </Link>
      <h1 className="mt-1 mb-4 text-2xl font-bold">自選練習</h1>
      <PracticeForm noteLessons={lessons} vocabCounts={counts} englishCount={english} preset={preset} />
    </>
  );
}
