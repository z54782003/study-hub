"use client";
import { useRef, useState } from "react";
import { Icon } from "./Icon";

const RATES = [0.75, 0.9, 1, 1.25] as const;

const mmss = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");

/** 朗讀音檔：播放鍵＋進度條＋速度切換 */
export function AudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState<number>(1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const pick = (r: number) => {
    setRate(r);
    if (ref.current) ref.current.playbackRate = r;
  };
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  return (
    <div className="space-y-2">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={(e) => {
          e.currentTarget.playbackRate = rate;
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "暫停" : "播放音檔"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <Icon name="play" size={20} stroke={0} className="fill-current" />
          )}
        </button>
        <input
          type="range"
          aria-label="音檔進度"
          min={0}
          max={Number.isFinite(duration) ? duration : 0}
          step={0.1}
          value={time}
          onChange={(e) => {
            const t = Number(e.target.value);
            setTime(t);
            if (ref.current) ref.current.currentTime = t;
          }}
          className="h-4 min-w-0 flex-1 accent-[var(--accent)]"
        />
        <span className="shrink-0 text-xs text-muted tabular-nums">
          {mmss(time)} / {mmss(duration)}
        </span>
      </div>
      <div role="group" aria-label="速度" className="flex gap-1.5">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pick(r)}
            aria-pressed={r === rate}
            className={`h-11 min-w-14 rounded-full border px-2 text-[13px] font-semibold tabular-nums ${r === rate ? "border-accent-soft bg-accent-soft text-accent" : "border-line bg-card text-ink-2"}`}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}
