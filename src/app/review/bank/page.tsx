import { redirect } from "next/navigation";

// 舊網址：題庫練習已改名題目練習
export default function BankRedirect() {
  redirect("/review/questions");
}
