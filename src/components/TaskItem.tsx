"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  date: string;
  id: string;
  icon: string;
  title: string;
  detail?: string;
  href?: string;
  external?: boolean;
  /** 由資料判斷已完成（例如複習已清空），不需手動勾 */
  autoDone?: boolean;
};

// 手動打勾的狀態只存在這台裝置（per-viewer 便利功能）；真正的學習紀錄都寫回 Notion。
const key = (date: string, id: string) => `done:${date}:${id}`;

export function TaskItem({ date, id, icon, title, detail, href, external, autoDone }: Props) {
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    try {
      setChecked(localStorage.getItem(key(date, id)) === "1");
    } catch {}
  }, [date, id]);

  const done = autoDone || checked;
  const toggle = () => {
    const next = !checked;
    setChecked(next);
    try {
      if (next) localStorage.setItem(key(date, id), "1");
      else localStorage.removeItem(key(date, id));
    } catch {}
  };

  const body = (
    <div className="min-w-0 flex-1">
      <div className={`font-medium leading-snug ${done ? "text-muted line-through" : ""}`}>
        <span className="mr-1.5">{icon}</span>
        {title}
      </div>
      {detail && <div className="mt-0.5 truncate text-sm text-muted">{detail}</div>}
    </div>
  );

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3">
      <button
        type="button"
        onClick={toggle}
        disabled={autoDone}
        aria-label={done ? "標記為未完成" : "標記為完成"}
        className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm ${
          done ? "border-ok bg-ok text-white" : "border-line"
        }`}
      >
        {done ? "✓" : ""}
      </button>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center">
            {body}
            <span className="ml-2 text-muted">↗</span>
          </a>
        ) : (
          <Link href={href} className="flex min-w-0 flex-1 items-center">
            {body}
            <span className="ml-2 text-muted">›</span>
          </Link>
        )
      ) : (
        body
      )}
    </li>
  );
}
