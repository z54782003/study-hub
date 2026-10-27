"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Status = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; pages: number; ratio: number };

/** 書頁裡直接讀 PDF：每一頁畫成圖，捲到才畫（iPhone 的 iframe 只會顯示第一頁，所以不用 iframe） */
export function PdfReader({ src, original, title }: { src: string; original: string; title: string }) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [current, setCurrent] = useState(1);
  const doc = useRef<PDFDocumentProxy | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const d = await pdfjs.getDocument({ url: src }).promise;
        if (cancelled) return void d.destroy();
        doc.current = d;
        const first = (await d.getPage(1)).getViewport({ scale: 1 });
        setStatus({ state: "ready", pages: d.numPages, ratio: first.height / first.width });
      } catch (e) {
        if (!cancelled) setStatus({ state: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
      void doc.current?.destroy();
      doc.current = null;
    };
  }, [src]);

  // 捲到附近才畫那一頁；同時記下現在看到第幾頁
  useEffect(() => {
    if (status.state !== "ready" || !box.current) return;
    const drawn = new Set<number>();
    const draw = async (canvas: HTMLCanvasElement) => {
      const n = Number(canvas.dataset.page);
      if (drawn.has(n) || !doc.current) return;
      drawn.add(n);
      const page = await doc.current.getPage(n);
      const width = canvas.parentElement!.clientWidth;
      const scale = (width / page.getViewport({ scale: 1 }).width) * Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    };
    const near = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && void draw(e.target as HTMLCanvasElement)),
      { rootMargin: "800px 0px" },
    );
    const seen = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setCurrent(Number((e.target as HTMLElement).dataset.page))),
      { threshold: 0.5 },
    );
    box.current.querySelectorAll("canvas").forEach((c) => {
      near.observe(c);
      seen.observe(c);
    });
    return () => {
      near.disconnect();
      seen.disconnect();
    };
  }, [status]);

  if (status.state === "error")
    return (
      <div className="card p-4 text-sm">
        <p className="font-bold text-bad">PDF 沒辦法在這裡顯示</p>
        <p className="mt-1 text-ink-2">
          可以直接開檔案看。（原因：{status.message}）
        </p>
        <a href={original} target="_blank" rel="noreferrer" className="mt-3 flex h-12 items-center justify-center rounded-[14px] bg-accent font-semibold text-on-accent">
          開啟 PDF
        </a>
      </div>
    );

  return (
    <section aria-label={`${title}（PDF）`} className="relative">
      {status.state === "loading" && <div className="card grid aspect-[3/4] place-items-center text-sm text-muted">載入 PDF…</div>}
      {status.state === "ready" && (
        <>
          {/* 頁碼浮在 PDF 右上角，不佔版面 */}
          <div className="sticky top-[max(env(safe-area-inset-top),0.5rem)] z-10 flex h-0 justify-end">
            <span className="mt-2 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-semibold text-bg tabular-nums">
              {current} / {status.pages} 頁
            </span>
          </div>
          <div ref={box} className="-mx-4 space-y-2 md:mx-0">
            {Array.from({ length: status.pages }, (_, i) => (
              <div key={i} className="bg-card shadow-card md:overflow-hidden md:rounded-xl" style={{ aspectRatio: `1 / ${status.ratio}` }}>
                <canvas data-page={i + 1} aria-label={`第 ${i + 1} 頁`} className="block h-full w-full" />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
