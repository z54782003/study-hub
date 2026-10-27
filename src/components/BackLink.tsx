import Link from "next/link";
import { Icon } from "./Icon";

/** 頁首返回連結（‹ 上一層） */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-ml-2 inline-flex h-11 items-center gap-0.5 px-2 text-base font-medium text-accent">
      <Icon name="back" stroke={2.2} />
      {children}
    </Link>
  );
}
