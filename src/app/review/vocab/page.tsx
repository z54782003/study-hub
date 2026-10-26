import { redirect } from "next/navigation";

// 舊網址：單字測驗已併入自選練習
export default function VocabRedirect() {
  redirect("/review/practice?type=vocab");
}
