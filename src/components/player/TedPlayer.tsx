"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Cue } from "@/lib/subtitles";
import type { TedTalk } from "@/lib/ted";
import { WordSheet } from "./WordSheet";
import { useRecorder } from "./useRecorder";
import { Icon } from "../Icon";

type Mode = "both" | "en" | "blind";
const MODES: { id: Mode; label: string }[] = [
  { id: "both", label: "中英" },
  { id: "en", label: "英文" },
  { id: "blind", label: "隱藏" },
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
  const [sheet, setSheet] = useState<{ word: string; sentence: string; at: string } | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  // ≥768px（iPad）：字幕左欄、字典卡右欄常駐
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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

  // 跟讀：按住錄本句、放開停止；很快放開（點一下）就一直錄到再點一次
  const pressedAt = useRef(0);
  const recordDown = async () => {
    if (recorder.recording) return recorder.stop();
    pressedAt.current = Date.now();
    videoRef.current?.pause();
    await recorder.start(Math.max(active, 0));
  };
  const recordUp = () => {
    if (pressedAt.current && Date.now() - pressedAt.current > 400) recorder.stop();
    pressedAt.current = 0;
  };

  // 外接鍵盤：空白鍵播放、←→ 上下句、R 重播、M 錄音
  const keys = useRef({ togglePlay, playCue, active, cues, recordDown });
  keys.current = { togglePlay, playCue, active, cues, recordDown };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input,textarea,[contenteditable]")) return;
      const k = keys.current;
      if (e.key === " ") k.togglePlay();
      else if (e.key === "ArrowLeft") k.playCue(Math.max(k.active - 1, 0));
      else if (e.key === "ArrowRight") k.playCue(Math.min(k.active + 1, k.cues.length - 1));
      else if (e.key === "r" || e.key === "R") k.playCue(Math.max(k.active, 0));
      else if (e.key === "m" || e.key === "M") void k.recordDown().then(() => (pressedAt.current = 0));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const lastRecorded = recorder.takes[Math.max(active, 0)];

  const subtitles = (
    <ol
      ref={listRef}
      onTouchMove={() => (userScrolledAt.current = Date.now())}
      onWheel={() => (userScrolledAt.current = Date.now())}
      className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
    >
      {cues.map((c, i) => {
        const isActive = i === active;
        const hidden = mode === "blind" && !revealed.has(i);
        return (
          <li
            key={i}
            data-i={i}
            aria-current={isActive || undefined}
            onClick={() => playCue(i)}
            className={`cursor-pointer rounded-[14px] px-2.5 py-2 transition-colors ${isActive ? "bg-accent-soft" : ""}`}
          >
            <p
              lang="en"
              className={`read leading-normal ${isActive ? "text-[19px] font-semibold" : "text-[17px]"} ${i < active ? "text-muted" : ""} ${hidden ? "blur-[5px] select-none" : ""}`}
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
                          setSheet({ word: t.s, sentence: c.text, at: `${i}:${k}` });
                        }}
                        className={`-mx-0.5 rounded-[5px] px-0.5 ${sheet?.at === `${i}:${k}` ? "bg-accent-soft ring-1 ring-accent/30" : ""}`}
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
                className="mt-1 h-8 text-xs font-semibold text-accent"
              >
                看這句
              </button>
            )}
            {mode === "both" && c.zh && <p className="mt-0.5 text-[13px] text-muted">{c.zh}</p>}
            {recorder.takes[i] && (
              <div className="mt-1.5 flex gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => playCue(i, { once: true })} className="h-9 rounded-full border border-line bg-card px-3 font-semibold text-ink-2">
                  ▶ 原音
                </button>
                <button type="button" onClick={() => recorder.play(i)} className="h-9 rounded-full bg-accent-soft px-3 font-semibold text-accent">
                  ▶ 我的錄音
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );

  const controls = (
    <section
      aria-label="播放控制"
      className={`shrink-0 space-y-2 bg-card px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] ${wide ? "card" : "rounded-t-[22px] shadow-sheet"}`}
    >
      <div className="flex items-center gap-2.5 text-xs text-muted tabular-nums">
        <span>{fmt(time)}</span>
        <input
          type="range"
          aria-label="播放進度"
          min={0}
          max={Number.isFinite(duration) ? duration : 0}
          step={0.1}
          value={time}
          onChange={(e) => {
            const v = videoRef.current;
            const t = Number(e.target.value);
            setTime(t);
            if (v) v.currentTime = t;
            playingCue.current = cueIndexAt(cues, t, offset);
          }}
          className="h-4 min-w-0 flex-1 accent-[var(--accent)]"
        />
        <span>{Number.isFinite(duration) ? fmt(duration) : "–:––"}</span>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => playCue(Math.max(active - 1, 0))} className="grid size-11 place-items-center text-ink" aria-label="上一句">
          <Icon name="prev" size={22} />
        </button>
        <button type="button" onClick={() => playCue(Math.max(active, 0))} className="grid size-11 place-items-center text-ink" aria-label="重播這一句">
          <Icon name="replay" size={22} />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!talk?.video}
          className="grid size-[60px] place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40"
          aria-label={playing ? "暫停" : "播放"}
        >
          {playing ? <Icon name="pause" size={24} stroke={3} /> : <Icon name="play" size={26} stroke={0} className="fill-current" />}
        </button>
        <button type="button" onClick={() => playCue(Math.min(active + 1, cues.length - 1))} className="grid size-11 place-items-center text-ink" aria-label="下一句">
          <Icon name="next" size={22} />
        </button>
        <button
          type="button"
          onClick={() => setRate((r) => RATES[(RATES.indexOf(r) + 1) % RATES.length])}
          className={`grid h-11 min-w-11 place-items-center text-sm font-bold tabular-nums ${rate !== 1 ? "text-accent" : "text-ink"}`}
          aria-label={`播放速度 ${rate}×，點一下換`}
        >
          {rate}×
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div role="group" aria-label="字幕顯示" className="grid flex-1 grid-cols-3 gap-1 rounded-[14px] bg-card-2 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setRevealed(new Set());
              }}
              className={`h-10 rounded-[10px] text-[13px] ${mode === m.id ? "bg-card font-bold text-ink shadow-card" : "font-semibold text-ink-2"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onPointerDown={() => void recordDown()}
          onPointerUp={recordUp}
          onPointerLeave={recordUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={recorder.recording ? "停止錄音" : "按住錄音跟讀"}
          className={`flex h-[46px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold whitespace-nowrap select-none ${
            recorder.recording ? "bg-bad-soft text-bad" : lastRecorded ? "bg-accent-soft text-accent" : "bg-card-2 text-ink"
          }`}
        >
          <Icon name="mic" size={18} />
          {recorder.recording ? "錄音中" : "跟讀"}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs whitespace-nowrap text-muted">字幕時間</span>
        <button type="button" onClick={() => changeOffset(-1)} className="h-9 w-9 rounded-[10px] border border-line text-ink-2" aria-label="字幕提早 1 秒">
          «
        </button>
        <button type="button" onClick={() => changeOffset(-0.25)} className="h-9 w-9 rounded-[10px] border border-line text-ink-2" aria-label="字幕提早 0.25 秒">
          ‹
        </button>
        <button
          type="button"
          onClick={() => changeOffset("reset")}
          className={`h-9 flex-1 text-[15px] font-bold whitespace-nowrap tabular-nums ${offset !== TED_DEFAULT_OFFSET ? "text-accent" : ""}`}
          aria-label="字幕偏移（點一下回到預設）"
        >
          {offset > 0 ? "+" : ""}
          {offset.toFixed(2)} 秒
        </button>
        <button type="button" onClick={() => changeOffset(0.25)} className="h-9 w-9 rounded-[10px] border border-line text-ink-2" aria-label="字幕延後 0.25 秒">
          ›
        </button>
        <button type="button" onClick={() => changeOffset(1)} className="h-9 w-9 rounded-[10px] border border-line text-ink-2" aria-label="字幕延後 1 秒">
          »
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <Toggle label="循環這句" icon="repeat" on={loop} onClick={() => setLoop((x) => !x)} />
        <Toggle label="每句播完暫停" icon="pauseAfter" on={autoPause} onClick={() => setAutoPause((x) => !x)} />
      </div>
      {recorder.error && <p className="text-center text-xs text-bad">{recorder.error}</p>}
      {current && recorder.recording && <p className="text-center text-xs text-bad">錄音中：跟讀「{current.text.slice(0, 30)}…」</p>}
    </section>
  );

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-2xl flex-col bg-bg pt-[max(env(safe-area-inset-top),0.75rem)] md:max-w-[1024px] md:px-4">
      <header className="flex items-center gap-1 px-1 pb-1">
        <Link href="/en" className="grid size-11 place-items-center text-accent" aria-label="返回英文">
          <Icon name="back" stroke={2.2} />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="read truncate text-[15px] font-bold" lang="en">
            {talk?.title || title}
          </h1>
          {talk?.speaker && <p className="truncate text-[11px] text-muted">{talk.speaker}</p>}
        </div>
        {notionUrl && notionUrl !== "#" ? (
          <a href={notionUrl} target="_blank" rel="noreferrer" className="grid h-11 place-items-center px-2 text-sm font-semibold text-accent">
            筆記 ↗
          </a>
        ) : (
          <span className="w-11" />
        )}
      </header>

      <div className="relative aspect-video max-h-[45vh] w-full shrink-0 bg-[#0e0f12] md:max-h-[40vh] md:overflow-hidden md:rounded-2xl">
        <video
          ref={videoRef}
          playsInline
          controls={false}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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

      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-4 pt-3">
          <div className="flex min-h-0 flex-col">{subtitles}</div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {sheet ? (
              <WordSheet docked word={sheet.word} sentence={sheet.sentence} onClose={() => setSheet(null)} />
            ) : (
              <div className="card p-5 text-sm text-muted">點字幕裡的單字查字典</div>
            )}
            {controls}
            <p className="text-center text-[11px] text-muted">空白鍵 播放・← → 上下句・R 重播・M 錄音</p>
          </div>
        </div>
      ) : (
        <>
          {subtitles}
          {controls}
          {sheet && <WordSheet word={sheet.word} sentence={sheet.sentence} onClose={() => setSheet(null)} />}
        </>
      )}
    </div>
  );
}

function Toggle({ label, icon, on, onClick }: { label: string; icon: "repeat" | "pauseAfter"; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${on ? "bg-accent-soft text-accent" : "text-muted"}`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
