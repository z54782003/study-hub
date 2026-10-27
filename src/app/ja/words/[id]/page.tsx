import { notFound } from "next/navigation";
import { getLessonVocab } from "@/lib/data";
import { LEVELS } from "@/lib/reviewSource";
import { WordCard } from "./WordCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "單字・Study Hub" };

export default async function WordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ level?: string; lesson?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const level = LEVELS.find((l) => l === q.level) ?? "初中級";
  const lesson = Math.max(1, Math.min(15, Number(q.lesson) || 1));
  const words = await getLessonVocab(level, lesson);
  const i = words.findIndex((w) => w.id === id);
  if (i < 0) notFound();
  const link = (w?: { id: string }) => (w ? `/ja/words/${w.id}?${new URLSearchParams({ level, lesson: String(lesson) })}` : null);
  return (
    <WordCard
      key={id}
      word={words[i]}
      index={i}
      total={words.length}
      back={`/ja/words?${new URLSearchParams({ level, lesson: String(lesson) })}`}
      backLabel={`第${lesson}課`}
      source={`できる日本語 ${level} 第${lesson}課`}
      prev={link(words[i - 1])}
      next={link(words[i + 1])}
    />
  );
}
