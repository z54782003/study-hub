"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

// 語言優先：日文／英文各自一頁，複習和紀錄跨語言
const TABS: { href: string; label: string; icon: IconName; also: string[] }[] = [
  { href: "/", label: "今日", icon: "sun", also: [] },
  { href: "/ja", label: "日文", icon: "ja", also: ["/n3"] },
  { href: "/en", label: "英文", icon: "en", also: ["/ted"] },
  { href: "/review", label: "複習", icon: "cards", also: ["/mistakes"] },
  { href: "/history", label: "紀錄", icon: "calendar", also: [] },
];

export function BottomNav() {
  const path = usePathname();
  if (path === "/login" || path.startsWith("/ted/") || path === "/play") return null;
  return (
    <nav aria-label="主要分頁" className="fixed inset-x-0 bottom-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl md:max-w-[760px]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : [t.href, ...t.also].some((h) => path.startsWith(h));
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[49px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? "text-accent" : "text-muted"}`}
              >
                <Icon name={t.icon} size={24} stroke={1.8} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
