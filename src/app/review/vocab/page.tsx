import { redirect } from "next/navigation";

// 舊網址：單字測驗已改名單字・漢字
export default function VocabRedirect() {
  redirect("/review/words");
}
