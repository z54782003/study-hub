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
        <h1 className="text-[28px] leading-[34px] font-bold">錯題區</h1>
        <Link href="/review/due" className="text-sm text-accent">
          今日到期 ›
        </Link>
      </header>
      <MistakeList items={items} />
    </>
  );
}
