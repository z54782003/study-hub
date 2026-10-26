"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 語言優先：日文／英文各自一頁，複習和紀錄跨語言
const TABS = [
  { href: "/", label: "今日", icon: "☀️", also: [] },
  { href: "/ja", label: "日文", icon: "🇯🇵", also: ["/n3"] },
  { href: "/en", label: "英文", icon: "🇬🇧", also: [] },
  { href: "/review", label: "複習", icon: "🔁", also: ["/mistakes"] },
  { href: "/history", label: "紀錄", icon: "📊", also: [] },
];

export function BottomNav() {
  const path = usePathname();
  if (path === "/login" || path.startsWith("/ted/") || path === "/play") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl md:max-w-2xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : [t.href, ...t.also].some((h) => path.startsWith(h));
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active ? "text-accent font-semibold" : "text-muted"}`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
