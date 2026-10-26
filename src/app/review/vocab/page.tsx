import Link from "next/link";
import { VocabForm } from "./VocabForm";
import { vocabLessonCounts } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "單字測驗・Study Hub" };

export default async function VocabPage() {
  const counts = await vocabLessonCounts();
  return (
    <>
      <Link href="/review" className="text-sm text-muted">
        ‹ 複習
      </Link>
      <h1 className="mt-1 mb-4 text-2xl font-bold">單字測驗</h1>
      <VocabForm counts={counts} />
    </>
  );
}
