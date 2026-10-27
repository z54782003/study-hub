"use client";
import { useEffect, useState } from "react";

/** 全域：連不上網路時在最上面提醒（作答要連線才寫得進 Notion） */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="alert" className="sticky top-0 z-50 flex items-center gap-3 bg-due-soft px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 text-sm">
      <span className="min-w-0 flex-1">
        <b className="text-due">連不上網路</b>
        <span className="text-ink-2">・作答要連線才會寫進 Notion，恢復後點重試。</span>
      </span>
      <button type="button" onClick={() => location.reload()} className="h-9 shrink-0 rounded-[10px] bg-accent px-3 font-semibold text-on-accent">
        重試
      </button>
    </div>
  );
}
