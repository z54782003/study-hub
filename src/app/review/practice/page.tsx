import { redirect } from "next/navigation";

// 舊網址：自選練習已拆成「單字・漢字」和「題目練習」
export default async function PracticeRedirect({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  const { type, ...rest } = q;
  const qs = new URLSearchParams(rest).toString();
  redirect(`/review/${type === "vocab" ? "words" : "questions"}${qs ? `?${qs}` : ""}`);
}
