import Link from "next/link";
import { PracticeForm, type PracticePreset } from "./PracticeForm";
import { englishVocabCount, noteLessons, vocabLessonCounts } from "@/lib/data";
import { FORMS } from "@/lib/conjugate";
import { LEVELS, parseLessons } from "@/lib/reviewSource";

type Query = Record<string, string | undefined>;

// ?lang=en、?level=初中級&lessons=3 這種網址用來從日文分頁「練習這課」帶條件過來
export async function PracticePage({ mode, query }: { mode: PracticePreset["mode"]; query: Query }) {
  const preset: PracticePreset = {
    mode,
    lang: query.lang === "en" ? "en" : "ja",
    level: LEVELS.find((l) => l === query.level) ?? "初中級",
    lessons: parseLessons(query.lessons ?? null),
    verbForms: (query.forms ?? "").split(",").filter((f) => (FORMS as readonly string[]).includes(f)),
  };
  const [lessons, counts, english] = await Promise.all([noteLessons(), vocabLessonCounts(), englishVocabCount().catch(() => 0)]);
  return (
    <>
      <Link href="/review" className="text-sm text-muted">
        ‹ 複習
      </Link>
      <h1 className="mt-1 mb-4 text-2xl font-bold">{mode === "words" ? "單字・漢字" : "題目練習"}</h1>
      <PracticeForm noteLessons={lessons} vocabCounts={counts} englishCount={english} preset={preset} />
    </>
  );
}
