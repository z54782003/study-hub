"use client";
import { useEffect } from "react";

/** 頁面讀取失敗（多半是 Notion 逾時或斷線）：說明狀況＋重試，不要整頁白掉 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section role="alert" className="mt-10 rounded-[18px] bg-bad-soft p-4">
      <h1 className="text-[15px] font-bold text-bad">這一頁讀取失敗</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">多半是 Notion 一時沒回應或網路斷線。已經送出的作答不受影響。</p>
      {error.digest && <p className="mt-1 text-xs text-muted">錯誤代碼：{error.digest}</p>}
      <button type="button" onClick={reset} className="mt-3 flex h-12 w-full items-center justify-center rounded-[14px] bg-accent text-[15px] font-semibold text-on-accent">
        再試一次
      </button>
    </section>
  );
}
