"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Talk = { id: string; title: string; progress: string | null };

// 做完打勾只記在這台裝置（Notion 的「進度」欄照舊自己改）
const key = (id: string) => `ted-done:${id}`;

/** 英文首頁的 TED 清單：今天的排第一並標「今天」，前面圓圈打勾 */
export function TedChecklist({ talks }: { talks: Talk[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const ids = talks.map((t) => t.id).join(",");
  useEffect(() => {
    const next: Record<string, boolean> = {};
    try {
      for (const id of ids.split(",")) next[id] = localStorage.getItem(key(id)) === "1";
    } catch {}
    setDone(next);
  }, [ids]);
  const toggle = (id: string) => {
    const on = !done[id];
    setDone((d) => ({ ...d, [id]: on }));
    try {
      if (on) localStorage.setItem(key(id), "1");
      else localStorage.removeItem(key(id));
    } catch {}
  };
  return (
    <ul className="card overflow-hidden">
      {talks.map((t) => {
        const on = !!done[t.id];
        const today = t.progress === "今天做";
        return (
          <li key={t.id} className={`flex items-center gap-0.5 border-b border-line pr-3.5 pl-1 last:border-b-0 ${today && !on ? "bg-accent-soft" : ""}`}>
            <button
              type="button"
              onClick={() => toggle(t.id)}
              aria-pressed={on}
              aria-label={`${on ? "取消完成" : "標為完成"}：${t.title}`}
              className="grid size-11 shrink-0 place-items-center"
            >
              <span className={`grid size-[22px] place-items-center rounded-full ${on ? "bg-ok text-card" : "border-2 border-line"}`}>
                {on && <Icon name="check" size={14} stroke={3.2} />}
              </span>
            </button>
            <Link href={`/ted/${t.id}`} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className={`read block text-[17px] leading-snug font-bold ${on ? "text-muted line-through" : ""}`} lang="en">
                  {t.title}
                </span>
                {t.progress && <span className="block text-xs text-muted">{t.progress}</span>}
              </span>
              {today && !on && <span className="tag bg-accent text-on-accent">今天</span>}
              <Icon name="chevron" size={18} stroke={2.4} className="shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
