"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Cue } from "@/lib/subtitles";
import type { TedTalk } from "@/lib/ted";
import { WordSheet } from "./WordSheet";
import { useRecorder } from "./useRecorder";

type Mode = "both" | "en" | "blind";
const MODES: { id: Mode; label: string }[] = [
  { id: "both", label: "中英" },
  { id: "en", label: "英文" },
  { id: "blind", label: "盲聽" },
];
const RATES = [0.5, 0.75, 0.9, 1, 1.25];
const TED_DEFAULT_OFFSET = 3.75;

/** 最後一個「開始時間 ≤ t」的句子 */
function cueIndexAt(cues: Cue[], t: number, offset: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start + offset <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// 把句子拆成「可點的英文單字」與其他字元
function tokens(text: string): { word: boolean; s: string }[] {
  return text.split(/([A-Za-z][A-Za-z'’-]*)/).filter(Boolean).map((s) => ({ word: /^[A-Za-z]/.test(s), s }));
}

export function TedPlayer({ tedUrl, title, notionUrl }: { tedUrl: string; title: string; notionUrl?: string }) {
  const [talk, setTalk] = useState<TedTalk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<Mode>("both");
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [autoPause, setAutoPause] = useState(false);
  const [offset, setOffset] = useState(0);
  const [videoNote, setVideoNote] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [sheet, setSheet] = useState<{ word: string; sentence: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const playingCue = useRef(-1); // 正在播的那一句（循環／自動暫停以它為準）
  const oneShot = useRef(false); // 「▶ 原音」只播一句
  const userScrolledAt = useRef(0);
  const settings = useRef({ loop, autoPause, offset });
  settings.current = { loop, autoPause, offset };
  const recorder = useRecorder();

  const cues = talk?.cues ?? [];

  useEffect(() => {
    fetch(`/api/ted?url=${encodeURIComponent(tedUrl)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? r.statusText);
        setTalk(data);
      })
      .catch((e) => setError(e.message));
  }, [tedUrl]);

  // TED 字幕整體比影片早一段片頭的長度（2026-10 實測 +3.75 秒），當作預設；
  // 個別 talk 調過的偏移記在這台裝置，下次打開不用重調。
  const offsetKey = `offset:${tedUrl}`;
  useEffect(() => {
    let saved = NaN;
    try {
      saved = parseFloat(localStorage.getItem(offsetKey) ?? "");
    } catch {}
    setOffset(Number.isNaN(saved) ? TED_DEFAULT_OFFSET : saved);
  }, [offsetKey]);
  const changeOffset = (delta: number | "reset") =>
    setOffset((o) => {
      const next = delta === "reset" ? TED_DEFAULT_OFFSET : Math.round((o + delta) * 100) / 100;
      try {
        if (next === TED_DEFAULT_OFFSET) localStorage.removeItem(offsetKey);
        else localStorage.setItem(offsetKey, String(next));
      } catch {}
      return next;
    });

  // 影片來源：HLS 在 Safari（iPhone／iPad）原生支援；其他瀏覽器用 hls.js，失敗再退回 mp4
  useEffect(() => {
    const v = videoRef.current;
    const video = talk?.video;
    if (!v || !video) return;
    const useFallback = () => {
      if (!video.fallback) return setError("影片無法播放");
      v.src = video.fallback;
      setVideoNote("改用 mp4 播放，字幕若整段錯開請用下方「字幕 ±」調整");
    };
    if (video.type === "mp4" || v.canPlayType("application/vnd.apple.mpegurl")) {
      if (video.type === "hls") v.addEventListener("error", useFallback, { once: true });
      v.src = video.url;
      return () => v.removeEventListener("error", useFallback);
    }
    let destroy: (() => void) | undefined;
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return useFallback();
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        hls.destroy();
        useFallback();
      });
      hls.loadSource(video.url);
      hls.attachMedia(v);
      destroy = () => hls.destroy();
    });
    return () => destroy?.();
  }, [talk]);

  // 用 requestAnimationFrame 追時間：timeupdate 只有每 250ms 一次，切句不夠準
  useEffect(() => {
    if (!playing || !cues.length) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current!;
      const { loop, autoPause, offset } = settings.current;
      const t = v.currentTime;
      const i = playingCue.current;
      const c = cues[i];
      if (c && t >= c.end + offset - 0.04) {
        if (loop && !oneShot.current) {
          v.currentTime = c.start + offset;
        } else if (autoPause || oneShot.current) {
          oneShot.current = false;
          v.pause();
          playingCue.current = Math.min(i + 1, cues.length - 1);
        } else {
          playingCue.current = cueIndexAt(cues, t, offset);
        }
      } else if (!c || t < c.start + offset - 0.3) {
        playingCue.current = cueIndexAt(cues, t, offset);
      }
      setActive(cueIndexAt(cues, v.currentTime, offset));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, cues]);

  // 自動捲到正在播的句子（使用者剛手動捲動過就先不搶）
  useEffect(() => {
    if (active < 0 || Date.now() - userScrolledAt.current < 4000) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const playCue = useCallback(
    (i: number, opts: { once?: boolean } = {}) => {
      const v = videoRef.current;
      if (!v || !cues[i]) return;
      v.currentTime = cues[i].start + offset;
      playingCue.current = i;
      oneShot.current = Boolean(opts.once);
      setActive(i);
      void v.play();
    },
    [cues, offset],
  );

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (playingCue.current < 0) playingCue.current = Math.max(cueIndexAt(cues, v.currentTime, offset), 0);
      void v.play();
    } else v.pause();
  };

  const record = async () => {
    if (recorder.recording) return recorder.stop();
    videoRef.current?.pause();
    await recorder.start(Math.max(active, 0));
  };

  if (error)
    return (
      <div className="mt-10 space-y-3">
        <p className="font-semibold text-bad">讀不到這支 TED</p>
        <p className="text-sm break-all text-muted">{error}</p>
        <a href={tedUrl} target="_blank" rel="noreferrer" className="inline-block text-accent">
          在 TED 網站開啟 ↗
        </a>
      </div>
    );

  const current = cues[active];

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-2xl flex-col bg-bg pt-[max(env(safe-area-inset-top),0.75rem)]">
      <header className="flex items-center gap-2 px-4 pb-2">
        <Link href="/" className="text-2xl leading-none text-muted" aria-label="回今日">
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{talk?.title || title}</h1>
          {talk?.speaker && <p className="truncate text-xs text-muted">{talk.speaker}</p>}
        </div>
        {notionUrl && notionUrl !== "#" && (
          <a href={notionUrl} target="_blank" rel="noreferrer" className="text-sm text-accent">
            筆記 ↗
          </a>
        )}
      </header>

      <div className="relative aspect-video w-full shrink-0 bg-black">
        <video
          ref={videoRef}
          playsInline
          controls={false}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={togglePlay}
          className="h-full w-full"
        />
        {!talk && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">讀取影片與字幕…</div>}
      </div>

      {videoNote && <p className="px-4 pt-2 text-xs text-muted">{videoNote}</p>}
      {talk && !talk.cues.length && (
        <p className="px-4 pt-3 text-sm text-muted">這支 talk 沒有找到英文字幕（可用語言：{talk.languages.join(", ") || "無"}）。</p>
      )}
      {talk && talk.cues.length > 0 && !talk.chinese && mode === "both" && (
        <p className="px-4 pt-2 text-xs text-muted">這支沒有中文字幕，只顯示英文。</p>
      )}

      <ol
        ref={listRef}
        onTouchMove={() => (userScrolledAt.current = Date.now())}
        onWheel={() => (userScrolledAt.current = Date.now())}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-3"
      >
        {cues.map((c, i) => {
          const isActive = i === active;
          const hidden = mode === "blind" && !revealed.has(i);
          return (
            <li
              key={i}
              data-i={i}
              onClick={() => playCue(i)}
              className={`cursor-pointer rounded-xl px-3 py-2 transition-colors ${isActive ? "bg-accent/12" : ""}`}
            >
              <div className="flex gap-2">
                <span className={`pt-1 text-[11px] tabular-nums ${isActive ? "text-accent" : "text-muted"}`}>{fmt(c.start)}</span>
                <div className="min-w-0 flex-1">
                  <p
                    lang="en"
                    className={`text-[17px] leading-relaxed ${isActive ? "font-medium" : "text-ink/80"} ${hidden ? "blur-[5px] select-none" : ""}`}
                  >
                    {hidden
                      ? c.text
                      : tokens(c.text).map((t, k) =>
                          t.word ? (
                            <span
                              key={k}
                              onClick={(e) => {
                                e.stopPropagation();
                                videoRef.current?.pause();
                                setSheet({ word: t.s, sentence: c.text });
                              }}
                              className="rounded active:bg-accent/25"
                            >
                              {t.s}
                            </span>
                          ) : (
                            <span key={k}>{t.s}</span>
                          ),
                        )}
                  </p>
                  {hidden && isActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevealed((s) => new Set(s).add(i));
                      }}
                      className="mt-1 text-xs text-accent"
                    >
                      看這句
                    </button>
                  )}
                  {mode === "both" && c.zh && <p className="mt-0.5 text-sm text-muted">{c.zh}</p>}
                  {recorder.takes[i] && (
                    <div className="mt-1.5 flex gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => playCue(i, { once: true })} className="rounded-full border border-line px-3 py-1">
                        ▶ 原音
                      </button>
                      <button type="button" onClick={() => recorder.play(i)} className="rounded-full border border-accent px-3 py-1 text-accent">
                        ▶ 我的錄音
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="shrink-0 border-t border-line bg-card px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setRevealed(new Set());
                }}
                className={`rounded-full px-2.5 py-1 ${mode === m.id ? "bg-ink text-bg" : "text-muted"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center text-muted">
            <span className="mr-0.5">字幕</span>
            <button type="button" onClick={() => changeOffset(-1)} className="px-1.5 py-1" aria-label="字幕提早 1 秒">
              «
            </button>
            <button type="button" onClick={() => changeOffset(-0.25)} className="px-1.5 py-1" aria-label="字幕提早 0.25 秒">
              ‹
            </button>
            <button
              type="button"
              onClick={() => changeOffset("reset")}
              className={`w-11 text-center tabular-nums ${offset !== TED_DEFAULT_OFFSET ? "text-accent" : ""}`}
              aria-label="字幕偏移（點一下回到預設）"
            >
              {offset > 0 ? "+" : ""}
              {offset.toFixed(2)}
            </button>
            <button type="button" onClick={() => changeOffset(0.25)} className="px-1.5 py-1" aria-label="字幕延後 0.25 秒">
              ›
            </button>
            <button type="button" onClick={() => changeOffset(1)} className="px-1.5 py-1" aria-label="字幕延後 1 秒">
              »
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Ctl label="循環" on={loop} onClick={() => setLoop((x) => !x)} icon="🔁" />
          <Ctl label="跟讀停" on={autoPause} onClick={() => setAutoPause((x) => !x)} icon="⏸︎" />
          <button type="button" onClick={() => playCue(Math.max(active - 1, 0))} className="px-2 text-2xl" aria-label="上一句">
            ⏮
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!talk?.video}
            className="grid size-14 place-items-center rounded-full bg-accent text-2xl text-white disabled:opacity-40"
            aria-label={playing ? "暫停" : "播放"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={() => playCue(Math.min(active + 1, cues.length - 1))} className="px-2 text-2xl" aria-label="下一句">
            ⏭
          </button>
          <Ctl label={`${rate}x`} on={rate !== 1} onClick={() => setRate((r) => RATES[(RATES.indexOf(r) + 1) % RATES.length])} icon="⏱" />
          <Ctl
            label={recorder.recording ? "停止" : "錄音"}
            on={recorder.recording}
            onClick={record}
            icon={recorder.recording ? "⏺" : "🎤"}
            danger={recorder.recording}
          />
        </div>
        {recorder.error && <p className="mt-1 text-center text-xs text-bad">{recorder.error}</p>}
        {current && recorder.recording && <p className="mt-1 text-center text-xs text-bad">錄音中：跟讀「{current.text.slice(0, 30)}…」</p>}
      </div>

      {sheet && <WordSheet word={sheet.word} sentence={sheet.sentence} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Ctl({ label, icon, on, onClick, danger }: { label: string; icon: string; on: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-12 flex-col items-center rounded-xl py-1 text-[10px] ${danger ? "text-bad" : on ? "text-accent" : "text-muted"}`}
    >
      <span className="text-lg leading-tight">{icon}</span>
      {label}
    </button>
  );
}
