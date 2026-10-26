"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "今日", icon: "☀️" },
  { href: "/review", label: "複習", icon: "🔁" },
  { href: "/n3", label: "N3 單字", icon: "🈁" },
];

export function BottomNav() {
  const path = usePathname();
  if (path === "/login" || path.startsWith("/ted/") || path === "/play") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl md:max-w-2xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
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
