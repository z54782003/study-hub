"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 月曆左右滑切月份（左滑＝下個月） */
export function MonthSwipe({ prev, next, children }: { prev: string; next: string | null; children: React.ReactNode }) {
  const router = useRouter();
  const [start, setStart] = useState<number | null>(null);
  return (
    <div
      className="touch-pan-y"
      onPointerDown={(e) => setStart(e.clientX)}
      onPointerUp={(e) => {
        if (start === null) return;
        const dx = e.clientX - start;
        if (dx > 60) router.replace(prev, { scroll: false });
        else if (dx < -60 && next) router.replace(next, { scroll: false });
        setStart(null);
      }}
      onPointerCancel={() => setStart(null)}
    >
      {children}
    </div>
  );
}
