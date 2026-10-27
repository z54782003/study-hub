import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export type Tone = "accent" | "due" | "exam" | "bad";

const SOFT: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  due: "bg-due-soft text-due",
  exam: "bg-exam-soft text-exam",
  bad: "bg-bad-soft text-bad",
};
const SOLID: Record<Tone, string> = {
  accent: "bg-accent text-on-accent",
  due: "bg-due text-card",
  exam: "bg-exam text-card",
  bad: "bg-bad text-card",
};

/** 一組入口列（共用一張卡片、列之間分隔線） */
export function EntryGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <nav aria-label={label} className="card divide-y divide-line overflow-hidden">
      {children}
    </nav>
  );
}

/** 分頁首頁用的入口：圖示方塊＋標題＋說明＋徽章＋箭頭 */
export function EntryCard({
  href,
  icon,
  title,
  detail,
  badge,
  tone = "accent",
  disabled,
  external,
  inGroup,
}: {
  href: string;
  icon: IconName;
  title: string;
  detail?: string;
  badge?: string | number;
  tone?: Tone;
  disabled?: boolean;
  external?: boolean;
  /** 放在 EntryGroup 裡：不畫自己的卡片 */
  inGroup?: boolean;
}) {
  const body = (
    <>
      <span className={`grid shrink-0 place-items-center ${inGroup ? "size-9 rounded-[10px]" : "size-10 rounded-xl"} ${disabled ? "bg-card-2 text-muted" : SOFT[tone]}`}>
        <Icon name={icon} size={inGroup ? 20 : 22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-bold ${inGroup ? "text-base" : "text-[17px]"}`}>{title}</span>
        {detail && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{detail}</span>}
      </span>
      {badge !== undefined && badge !== "" && !disabled && (
        <span className={`grid h-[26px] min-w-[26px] shrink-0 place-items-center rounded-full px-2 text-[13px] font-bold tabular-nums ${SOLID[tone]}`}>
          {badge}
        </span>
      )}
      {!disabled &&
        (external ? <Icon name="external" size={18} stroke={2} className="shrink-0 text-muted" label="外部連結" /> : <Icon name="chevron" size={18} stroke={2.4} className="shrink-0 text-muted" />)}
    </>
  );
  const cls = `flex items-center gap-3 px-3.5 ${inGroup ? "min-h-16 py-2.5" : "card min-h-[76px] py-3"} ${disabled ? "opacity-60" : "active:bg-card-2"}`;
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
