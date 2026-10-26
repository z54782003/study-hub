import { ReviewSession } from "../ReviewSession";

export const metadata = { title: "今日到期・Study Hub" };

export default function DuePage() {
  return <ReviewSession source={{ src: "due" }} />;
}
