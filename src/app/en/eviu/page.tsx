import { BackLink } from "@/components/BackLink";
import { getEviuUnits, today } from "@/lib/data";
import { EviuList } from "./EviuList";

export const dynamic = "force-dynamic";
export const metadata = { title: "English Vocabulary in Use・Study Hub" };

/** English Vocabulary in Use：100 個單元的 Status，點開可以標 Studying／Reviewing／Done、填 Studied 日期 */
export default async function EviuPage() {
  const units = await getEviuUnits();
  return (
    <>
      <BackLink href="/en">英文</BackLink>
      <h1 className="mt-1 mb-1 text-[28px] leading-[34px] font-bold">English Vocabulary in Use</h1>
      <EviuList units={units} today={today()} />
    </>
  );
}
