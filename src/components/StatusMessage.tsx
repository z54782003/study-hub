import Link from "next/link";
import { Icon } from "./Icon";

type Action = { label: string; href: string; external?: boolean };

/** 空狀態／錯誤：先說現在的狀況，再說下一步；最多一個按鈕。錯誤用 ng／due，空狀態中性灰 */
export function StatusMessage({
  title,
  body,
  action,
  tone = "empty",
  className = "",
}: {
  title: string;
  body?: string;
  action?: Action;
  tone?: "empty" | "error" | "warn";
  className?: string;
}) {
  const box = tone === "error" ? "bg-bad-soft" : tone === "warn" ? "bg-due-soft" : "card";
  const head = tone === "error" ? "text-bad" : tone === "warn" ? "text-due" : "";
  return (
    <section role={tone === "empty" ? undefined : "alert"} className={`rounded-[18px] p-4 ${box} ${className}`}>
      <h2 className={`text-[15px] font-bold ${head}`}>{title}</h2>
      {body && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-2">{body}</p>}
      {action &&
        (action.external ? (
          <a
            href={action.href}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 flex h-12 items-center justify-center gap-1.5 rounded-[14px] text-[15px] font-semibold ${tone === "empty" ? "border border-line bg-card" : "bg-accent text-on-accent"}`}
          >
            {action.label}
            <Icon name="external" size={16} stroke={2} />
          </a>
        ) : (
          <Link
            href={action.href}
            className={`mt-3 flex h-12 items-center justify-center rounded-[14px] text-[15px] font-semibold ${tone === "empty" ? "border border-line bg-card" : "bg-accent text-on-accent"}`}
          >
            {action.label}
          </Link>
        ))}
    </section>
  );
}
