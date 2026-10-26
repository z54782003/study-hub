import { PracticePage } from "../practicePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "題目練習・Study Hub" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PracticePage mode="questions" query={await searchParams} />;
}
