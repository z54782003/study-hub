// 字幕與 HLS 播放清單的純函式解析（沒有網路存取，方便測試）。

export type Cue = { start: number; end: number; text: string; zh?: string };

// ── WebVTT ──────────────────────────────────────────

function parseTimestamp(s: string): number {
  const parts = s.trim().split(":");
  const sec = parseFloat(parts.pop()!.replace(",", "."));
  const min = parts.length ? parseInt(parts.pop()!, 10) : 0;
  const hr = parts.length ? parseInt(parts.pop()!, 10) : 0;
  return hr * 3600 + min * 60 + sec;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function cleanCueText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = vtt.replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const text = cleanCueText(lines.slice(i + 1).join(" "));
    if (!text) continue;
    cues.push({ start: parseTimestamp(a), end: parseTimestamp(b.trim().split(/\s+/)[0]), text });
  }
  return cues;
}

/** HLS 字幕片段的 X-TIMESTAMP-MAP（用來診斷字幕與影片時間軸的差距） */
export function parseTimestampMap(vtt: string): string | null {
  return vtt.match(/X-TIMESTAMP-MAP=([^\r\n]+)/)?.[1]?.trim() ?? null;
}

/** HLS 會把同一句切在兩個片段裡重複出現，依開始時間＋文字去重並排序。 */
export function dedupeCues(cues: Cue[]): Cue[] {
  const seen = new Set<string>();
  return cues
    .filter((c) => {
      const k = `${c.start.toFixed(2)}|${c.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.start - y.start);
}

/** 依時間重疊把中文配到英文句子上。 */
export function mergeBilingual(en: Cue[], zh: Cue[]): Cue[] {
  return en.map((c) => {
    let best: Cue | undefined;
    let bestOverlap = 0;
    for (const z of zh) {
      if (z.start > c.end) break;
      const overlap = Math.min(c.end, z.end) - Math.max(c.start, z.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = z;
      }
    }
    return best ? { ...c, zh: best.text } : c;
  });
}

// ── HLS 播放清單 ────────────────────────────────────

function parseAttributes(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) out[m[1]] = m[2].replace(/^"|"$/g, "");
  return out;
}

export type SubtitleTrack = { language: string; name: string; uri: string };

export function parseMasterSubtitles(m3u8: string, baseUrl: string): SubtitleTrack[] {
  return m3u8
    .split(/\r?\n/)
    .filter((l) => l.startsWith("#EXT-X-MEDIA:") && l.includes("TYPE=SUBTITLES"))
    .map((l) => parseAttributes(l.slice("#EXT-X-MEDIA:".length)))
    .filter((a) => a.URI)
    .map((a) => ({ language: (a.LANGUAGE ?? "").toLowerCase(), name: a.NAME ?? "", uri: new URL(a.URI, baseUrl).toString() }));
}

export function parseMediaSegments(m3u8: string, baseUrl: string): string[] {
  return m3u8
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => new URL(l, baseUrl).toString());
}

/** 繁中優先，其次簡中／任何中文。 */
export function pickChinese(tracks: SubtitleTrack[]): SubtitleTrack | undefined {
  const order = ["zh-tw", "zh-hant", "zh-hk", "zh-cn", "zh-hans", "zh"];
  for (const code of order) {
    const t = tracks.find((x) => x.language === code);
    if (t) return t;
  }
  return tracks.find((x) => x.language.startsWith("zh"));
}

export function pickEnglish(tracks: SubtitleTrack[]): SubtitleTrack | undefined {
  return tracks.find((x) => x.language === "en") ?? tracks.find((x) => x.language.startsWith("en"));
}

// ── TED talk 頁 ────────────────────────────────────

export type TedVideo = {
  id: string;
  title: string;
  speaker: string;
  duration: number;
  hls: string | null;
  mp4: string | null;
  youtube: string | null;
};

export function parseTedPage(html: string): TedVideo {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("TED 頁面找不到 __NEXT_DATA__（頁面結構可能改了）");
  const data = JSON.parse(m[1]);
  const v = data?.props?.pageProps?.videoData;
  if (!v) throw new Error("TED 頁面沒有 videoData");
  let player = v.videoPlayerData ?? v.playerData ?? {};
  if (typeof player === "string") player = JSON.parse(player);
  const res = player.resources ?? {};
  const h264: { file?: string; bitrate?: number }[] = Array.isArray(res.h264) ? res.h264 : [];
  // 手機用：挑最接近 950k 的 mp4
  const mp4 = [...h264]
    .filter((r) => r.file)
    .sort((a, b) => Math.abs((a.bitrate ?? 0) - 950) - Math.abs((b.bitrate ?? 0) - 950))[0]?.file;
  const ext = player.external ?? {};
  return {
    id: String(v.id ?? ""),
    title: v.title ?? "",
    speaker: v.presenterDisplayName ?? "",
    duration: Number(v.duration ?? 0),
    hls: res.hls?.stream ?? null,
    mp4: mp4 ?? null,
    youtube: String(ext.service ?? "").toLowerCase() === "youtube" ? (ext.code ?? null) : null,
  };
}
