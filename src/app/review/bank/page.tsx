import { redirect } from "next/navigation";

// 舊網址：題庫練習已併入自選練習
export default function BankRedirect() {
  redirect("/review/practice?type=bank");
}
