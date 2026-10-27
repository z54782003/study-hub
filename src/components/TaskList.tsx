"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export type Task = {
  id: string;
  title: string;
  sub?: string;
  href?: string;
  external?: boolean;
  /** 右側小標（例如「24 張」） */
  tag?: string;
  /** 由資料判斷已完成（例如複習已清空），不需手動勾 */
  autoDone?: boolean;
};
/** 字串＝分隔線（例如「13:00–16:10 上課」） */
export type TaskRow = Task | string;

// 手動打勾的狀態只存在這台裝置（per-viewer 便利功能）；真正的學習紀錄都寫回 Notion。
const key = (date: string, id: string) => `done:${date}:${id}`;

function TaskLink({ t, className, children }: { t: Task; className: string; children: React.ReactNode }) {
  if (!t.href) return <div className={className}>{children}</div>;
  if (t.external)
    return (
      <a href={t.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  return (
    <Link href={t.href} className={className}>
      {children}
    </Link>
  );
}

/** 今日任務：順序固定、點圓圈打勾、點文字進功能；第一個沒勾的是「下一件」，底部主按鈕跟著它 */
export function TaskList({ date, rows }: { date: string; rows: TaskRow[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const ids = rows.flatMap((r) => (typeof r === "string" ? [] : [r.id])).join(",");
  useEffect(() => {
    const next: Record<string, boolean> = {};
    try {
      for (const id of ids.split(",")) next[id] = localStorage.getItem(key(date, id)) === "1";
    } catch {}
    setChecked(next);
  }, [date, ids]);

  const tasks = rows.filter((r): r is Task => typeof r !== "string");
  const isDone = (t: Task) => !!t.autoDone || !!checked[t.id];
  const next = tasks.find((t) => !isDone(t));
  const count = tasks.filter(isDone).length;

  const toggle = (id: string) => {
    const on = !checked[id];
    setChecked((c) => ({ ...c, [id]: on }));
    try {
      if (on) localStorage.setItem(key(date, id), "1");
      else localStorage.removeItem(key(date, id));
    } catch {}
  };

  return (
    <>
      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">今天要做</h2>
        <span className="text-[13px] text-ink-2 tabular-nums">
          {count} / {tasks.length} 完成
        </span>
      </div>
      <ul className="card overflow-hidden">
        {rows.map((r) => {
          if (typeof r === "string")
            return (
              <li key={r} className="flex items-center gap-2.5 border-b border-line bg-card-2 px-4 py-2 text-xs font-semibold text-muted">
                <span className="h-px flex-1 bg-line" />
                {r}
                <span className="h-px flex-1 bg-line" />
              </li>
            );
          const done = isDone(r);
          const now = r === next;
          return (
            <li key={r.id} className={`flex items-center gap-0.5 border-b border-line py-1 pr-4 pl-1 last:border-b-0 ${now ? "bg-accent-soft" : ""}`}>
              <button
                type="button"
                onClick={() => toggle(r.id)}
                disabled={r.autoDone}
                aria-pressed={done}
                aria-label={`${done ? "取消完成" : "標為完成"}：${r.title}`}
                className="grid size-11 shrink-0 place-items-center"
              >
                <span className={`grid size-[22px] place-items-center rounded-full ${done ? "bg-ok text-card" : "border-2 border-line"}`}>
                  {done && <Icon name="check" size={14} stroke={3.2} />}
                </span>
              </button>
              <TaskLink t={r} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] leading-snug ${now ? "font-bold" : "font-semibold"} ${done ? "text-muted line-through" : ""}`}>{r.title}</span>
                  {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                </span>
                {r.tag && !done && <span className="tag bg-due-soft text-due">{r.tag}</span>}
                {r.external && <Icon name="external" size={16} stroke={2} className="shrink-0 text-muted" label="外部連結" />}
              </TaskLink>
            </li>
          );
        })}
      </ul>

      {/* 主按鈕＝第一個沒勾的任務，貼在分頁列上方 12px */}
      <div className="h-20" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom)+12px)] px-4">
        <div className="pointer-events-auto mx-auto max-w-xl md:max-w-[728px]">
          {next ? (
            <TaskLink t={next} className="btn-primary w-full px-4">
              <span className="truncate">下一件：{next.title}</span>
            </TaskLink>
          ) : (
            <div className="btn-primary w-full !bg-ok-soft !text-ok !shadow-none">今天都做完了</div>
          )}
        </div>
      </div>
    </>
  );
}
