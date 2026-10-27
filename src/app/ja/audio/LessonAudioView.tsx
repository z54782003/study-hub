"use client";
import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Icon } from "@/components/Icon";
import type { Track, TranscriptPart } from "@/lib/lessonAudio";

type Row = Track & { url: string | null };

type Scene = TranscriptPart["scenes"][number];

/** 一段課文：「人名　台詞」 */
function Lines({ lines }: { lines: Scene["lines"] }) {
  return (
    <div className="space-y-1.5 text-[15px] leading-relaxed">
      {lines.map((l, j) =>
              l.speaker ? (
                <p key={j} className="grid grid-cols-[auto_1fr] gap-x-2">
                  <span className="min-w-[3.5em] text-[13px] font-bold text-accent">{l.speaker}</span>
                  <span>{l.text}</span>
                </p>
              ) : (
                <p key={j} className={l.text === "⋮" || l.text === "＊＊＊" ? "pl-[4.2em] text-muted" : ""}>
                  {l.text}
                </p>
              ),
      )}
    </div>
  );
}

/** 課文全文：場面標題＋台詞 */
function Transcript({ part }: { part: TranscriptPart }) {
  return (
    <div className="space-y-3 border-t border-line px-4 py-3" lang="ja">
      {part.scenes.map((s, i) => (
        <section key={i}>
          {s.title && <h4 className="mb-1 text-xs font-bold text-muted">{s.title}</h4>}
          <Lines lines={s.lines} />
        </section>
      ))}
    </div>
  );
}

function TrackRow({ t, active, onPick }: { t: Row; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      disabled={!t.url}
      onClick={onPick}
      aria-current={active || undefined}
      className={`flex min-h-12 w-full items-center gap-3 px-4 text-left disabled:opacity-50 ${active ? "bg-accent-soft" : ""}`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${active ? "bg-accent text-on-accent" : "bg-card-2 text-ink-2"}`}>
        <Icon name="play" size={14} stroke={0} className="fill-current" />
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold" lang="ja">
        {t.label}
      </span>
      <span className="shrink-0 text-xs text-muted tabular-nums">{t.url ? String(t.no).padStart(3, "0") : "沒有檔案"}</span>
    </button>
  );
}

export function LessonAudioView({ tracks, transcript, st }: { tracks: Row[]; transcript: TranscriptPart[]; st: [string, string] | null }) {
  const [current, setCurrent] = useState<number | null>(null);
  const playing = tracks.find((t) => t.no === current);
  const row = (t: Row) => <TrackRow key={t.no} t={t} active={t.no === current} onPick={() => setCurrent(t.no)} />;
  const part = (name: string) => transcript.find((p) => p.heading.includes(name));
  const full = tracks.filter((t) => t.kind === "full");
  const read = tracks.filter((t) => t.kind === "read");
  const listen = part("聞いて");
  const story = part("話読聞書");
  // チャレンジ各場面有自己的課文（Notion「## チャレンジ」底下「### ST1 1」）
  const challenge = part("チャレンジ");
  const sceneText = (t: Row) =>
    t.kind === "scene" ? challenge?.scenes.find((s) => s.title === `ST${t.st} ${t.label.replace("チャレンジ ", "")}`) : undefined;

  return (
    <>
      <div className="mb-24 space-y-3">
        {full.length > 0 && (
          <div className="card overflow-hidden">
            {full.map(row)}
            {listen ? <Transcript part={listen} /> : <p className="border-t border-line px-4 py-3 text-sm text-muted">讀不到這課的課文（Notion「初中級課本索引」）</p>}
          </div>
        )}

        {([1, 2] as const).map((n) => {
          const list = tracks.filter((t) => t.st === n);
          if (!list.length) return null;
          return (
            <section key={n} className="card overflow-hidden">
              <h3 className="px-4 pt-3 pb-1 text-[13px] font-bold text-ink-2" lang="ja">
                ST{n}{st && `　${st[n - 1]}`}
              </h3>
              <div className="divide-y divide-line">
                {list.map((t) => {
                  const text = sceneText(t);
                  return (
                    <div key={t.no}>
                      {row(t)}
                      {text && (
                        <div className="px-4 pt-1 pb-3" lang="ja">
                          <Lines lines={text.lines} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {read.length > 0 && (
          <div className="card overflow-hidden">
            {read.map(row)}
            {story && <Transcript part={story} />}
          </div>
        )}
      </div>

      {playing?.url && (
        <div className="fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-card px-4 py-2">
          <div className="mx-auto flex max-w-xl items-center gap-2 md:max-w-[760px]">
            <span className="max-w-24 shrink-0 truncate text-xs font-bold text-muted" lang="ja">
              {playing.st ? `ST${playing.st} ` : ""}
              {playing.label.replace("（全文）", "")}
            </span>
            <div className="min-w-0 flex-1">
              <AudioPlayer key={playing.url} src={playing.url} compact autoPlay label={playing.label} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
