"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useTedDone } from "@/components/player/useTedDone";

type Talk = { id: string; title: string; progress: string | null };

/** 一支 talk：圓圈打勾＝TED Log 進度改成「完成」並填完成日（再按一次改回原本的） */
function TedRow({ t }: { t: Talk }) {
  const { done: on, progress, busy, error, toggle } = useTedDone(t.id, t.progress);
  const today = t.progress === "今天做";
  return (
    <li className={`flex items-center gap-0.5 border-b border-line pr-3.5 pl-1 last:border-b-0 ${today && !on ? "bg-accent-soft" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={`${on ? "取消完成" : "標為完成"}：${t.title}`}
        className="grid size-11 shrink-0 place-items-center"
      >
        <span className={`grid size-[22px] place-items-center rounded-full ${on ? "bg-ok text-card" : "border-2 border-line"} ${busy ? "opacity-50" : ""}`}>
          {on && <Icon name="check" size={14} stroke={3.2} />}
        </span>
      </button>
      <Link href={`/ted/${t.id}`} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className={`read block text-[17px] leading-snug font-bold ${on ? "text-muted line-through" : ""}`} lang="en">
            {t.title}
          </span>
          {error ? <span className="block text-xs text-bad">寫回失敗：{error}</span> : progress && <span className="block text-xs text-muted">{progress}</span>}
        </span>
        {today && !on && <span className="tag bg-accent text-on-accent">今天</span>}
        <Icon name="chevron" size={18} stroke={2.4} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

/** 英文首頁的 TED 清單：今天的排第一並標「今天」，打勾會寫回 Notion TED Log */
export function TedChecklist({ talks }: { talks: Talk[] }) {
  return (
    <ul className="card overflow-hidden">
      {talks.map((t) => (
        <TedRow key={t.id} t={t} />
      ))}
    </ul>
  );
}
