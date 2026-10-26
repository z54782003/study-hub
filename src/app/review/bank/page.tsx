import Link from "next/link";
import { BankForm } from "./BankForm";
import { noteLessons } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "題庫練習・Study Hub" };

export default async function BankPage() {
  const lessons = await noteLessons();
  return (
    <>
      <Link href="/review" className="text-sm text-muted">
        ‹ 複習
      </Link>
      <h1 className="mt-1 mb-4 text-2xl font-bold">題庫練習</h1>
      <BankForm lessons={lessons} />
    </>
  );
}
