import { PracticePage } from "../practicePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "單字・漢字・Study Hub" };

export default async function WordsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PracticePage mode="words" query={await searchParams} />;
}
