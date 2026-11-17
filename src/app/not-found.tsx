import { StatusMessage } from "@/components/StatusMessage";

export default function NotFound() {
  return <StatusMessage className="mt-10" title="找不到這一頁" body="連結可能已經改了，或這筆資料已經不在 Notion 裡。" action={{ label: "回今日", href: "/" }} />;
}
