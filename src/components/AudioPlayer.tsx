"use client";
import { useRef, useState } from "react";

const RATES = [0.75, 0.9, 1, 1.25] as const;

/** 朗讀音檔：原生播放器＋速度切換 */
export function AudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState<number>(1);
  const pick = (r: number) => {
    setRate(r);
    if (ref.current) ref.current.playbackRate = r;
  };
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <audio ref={ref} src={src} controls preload="none" className="w-full" onPlay={(e) => (e.currentTarget.playbackRate = rate)} />
      <div className="mt-2 flex items-center gap-1.5 text-sm">
        <span className="mr-1 text-xs text-muted">速度</span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pick(r)}
            className={`rounded-full border px-2.5 py-0.5 ${r === rate ? "border-accent bg-accent text-white" : "border-line"}`}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}
