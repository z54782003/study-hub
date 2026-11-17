// 單字庫「發音檔」欄的檔名：{種類}-{內容雜湊 8 碼}-{產生設定雜湊 6 碼}.mp3
//   種類：w＝單字、e1＝例句、e2＝例句2
//   內容雜湊：Notion 的文字（單字＋音標/假名＋聲調／例句）。App 用它判斷音檔還是不是最新的，對不上就退回瀏覽器發音。
//   產生設定雜湊：語者、讀音表、比對規則的版本。腳本用它判斷要不要重產（換語者就全部重產）。
// 腳本（scripts/gen-audio.ts）和伺服器端（src/lib/data.ts）共用；用到 node:crypto，不要在瀏覽器端 import。
import { createHash } from "node:crypto";
import type { AudioRef } from "./types";

export type AudioKind = "w" | "e1" | "e2";
export const AUDIO_KINDS: AudioKind[] = ["w", "e1", "e2"];
export const AUDIO_PROPERTY = "發音檔";

export type AudioSource = { word: string; reading: string; pitch: number | null; ex1: string; ex2: string };

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

/** 這種音檔的文字；沒有就不產（例句2 空白、單字帶「〜」） */
export function audioText(kind: AudioKind, src: AudioSource): string | null {
  if (kind === "w") return /[〜～~]/.test(src.word) || !src.word.trim() ? null : JSON.stringify([src.word, src.reading, src.pitch]);
  const t = (kind === "e1" ? src.ex1 : src.ex2).trim();
  return t || null;
}

export const contentHash = (kind: AudioKind, text: string) => sha1(`${kind}\n${text}`).slice(0, 8);

export const audioFileName = (kind: AudioKind, content: string, gen: string) => `${kind}-${content}-${gen}.mp3`;

export function parseAudioFileName(name: string): { kind: AudioKind; content: string; gen: string } | null {
  const m = name.match(/^(w|e1|e2)-([0-9a-f]{8})-([0-9a-f]{6})\.mp3$/);
  return m ? { kind: m[1] as AudioKind, content: m[2], gen: m[3] } : null;
}

/** 腳本用：產生設定的雜湊（語者、讀音表…）；任何一項改了，所有音檔都會重產 */
export const genHash = (settings: unknown) => sha1(JSON.stringify(settings)).slice(0, 6);

/**
 * 伺服器端：從 Notion 頁面的「發音檔」欄挑出還是最新的音檔（內容雜湊和目前的文字對得上）。
 * Notion 檔案網址一小時後失效，fallback 是 App 的轉址路徑，播放時過期了就走它。
 */
export function currentAudio(
  pageId: string,
  src: AudioSource,
  files: { name: string; url: string; expires: string | null }[],
): Partial<Record<AudioKind, AudioRef>> {
  const out: Partial<Record<AudioKind, AudioRef>> = {};
  for (const f of files) {
    const p = parseAudioFileName(f.name);
    if (!p) continue;
    const text = audioText(p.kind, src);
    if (text && contentHash(p.kind, text) === p.content)
      out[p.kind] = { url: f.url, expires: f.expires, fallback: `/api/vocab-audio/${pageId}/${p.kind}` };
  }
  return out;
}
