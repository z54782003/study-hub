import { ReviewSession } from "../ReviewSession";
import { parseSource } from "@/lib/reviewSource";

export const metadata = { title: "複習・Study Hub" };

export default async function SessionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const source = parseSource(new URLSearchParams(await searchParams));
  return <ReviewSession source={source} />;
}
