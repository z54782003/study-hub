import Link from "next/link";
import { MistakeList } from "./MistakeList";
import { getMistakes } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "錯題區・Study Hub" };

export default async function MistakesPage() {
  const items = await getMistakes();
  return (
    <>
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">錯題區</h1>
        <Link href="/review" className="text-sm text-accent">
          今晚複習 ›
        </Link>
      </header>
      <MistakeList items={items} />
    </>
  );
}
