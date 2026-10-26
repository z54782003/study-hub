import { ReviewSession } from "@/app/review/ReviewSession";

export const metadata = { title: "錯題重測・Study Hub" };

export default function RetestPage() {
  return <ReviewSession mode="mistakes" />;
}
