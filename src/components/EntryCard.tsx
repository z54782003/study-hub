import Link from "next/link";

/** 分頁首頁用的大按鈕 */
export function EntryCard({
  href,
  icon,
  title,
  detail,
  badge,
  disabled,
  external,
}: {
  href: string;
  icon: string;
  title: string;
  detail?: string;
  badge?: string | number;
  disabled?: boolean;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="text-2xl leading-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {detail && <span className="mt-0.5 block text-sm text-muted">{detail}</span>}
      </span>
      {badge !== undefined && badge !== "" && (
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-sm font-semibold text-accent tabular-nums">{badge}</span>
      )}
      {!disabled && <span className="text-muted">›</span>}
    </>
  );
  const cls = `flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 ${disabled ? "opacity-50" : "active:bg-bg"}`;
  if (disabled) return <div className={cls}>{body}</div>;
  if (external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {body}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}
