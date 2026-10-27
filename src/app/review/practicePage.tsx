import { PracticeForm, type PracticePreset } from "./PracticeForm";
import { FORMS } from "@/lib/conjugate";
import { EXAMS, KANJI_CHAPTERS } from "@/lib/config";
import { englishVocabCount, kanjiChapterCounts, noteLessons, today, vocabLessonCounts } from "@/lib/data";
import { examChapters, GROUPS, LEVELS, parseLessons } from "@/lib/reviewSource";
import { BackLink } from "@/components/BackLink";

/** 下一場漢字テスト的章（例：HSJⅡ 1章、2章） */
function nextKanjiExamChapters(): string[] {
  const day = today();
  for (const e of EXAMS) {
    if (e.date < day) continue;
    const i = e.name.split("／").findIndex((n) => n.includes("漢字"));
    if (i >= 0) return examChapters(e.scope.split("／")[i] ?? e.scope);
  }
  return [];
}

type Query = Record<string, string | undefined>;

// ?lang=en、?level=初中級&lessons=3 這種網址用來從日文分頁「練習這課」帶條件過來
export async function PracticePage({ mode, query }: { mode: PracticePreset["mode"]; query: Query }) {
  const preset: PracticePreset = {
    mode,
    lang: query.lang === "en" ? "en" : "ja",
    level: LEVELS.find((l) => l === query.level) ?? "初中級",
    lessons: parseLessons(query.lessons ?? null),
    verbForms: (query.forms ?? "").split(",").filter((f) => (FORMS as readonly string[]).includes(f)),
    verbGroups: (query.groups ?? "").split(",").filter((g) => (GROUPS as readonly string[]).includes(g)),
    kanjiChapters: query.chapters ? query.chapters.split(",").filter((c) => KANJI_CHAPTERS.includes(c)) : nextKanjiExamChapters(),
    kanji: query.type === "kanji" || Boolean(query.chapters),
    fromLink: Boolean(query.level || query.lessons || query.forms || query.groups || query.chapters),
  };
  const [lessons, counts, english, kanjiCounts] = await Promise.all([
    noteLessons(),
    vocabLessonCounts(),
    englishVocabCount().catch(() => 0),
    kanjiChapterCounts().catch(() => ({}) as Record<string, number>),
  ]);
  return (
    <>
      <BackLink href="/review">複習</BackLink>
      <h1 className="mt-1 mb-4 text-[28px] leading-[34px] font-bold">{mode === "words" ? "單字・漢字" : "題目練習"}</h1>
      <PracticeForm noteLessons={lessons} vocabCounts={counts} englishCount={english} kanjiCounts={kanjiCounts} preset={preset} />
    </>
  );
}
