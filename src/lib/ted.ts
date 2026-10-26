import "server-only";
import {
  dedupeCues,
  mergeBilingual,
  parseMasterSubtitles,
  parseMediaSegments,
  parseTedPage,
  parseTimestampMap,
  parseVtt,
  pickChinese,
  pickEnglish,
  type Cue,
  type SubtitleTrack,
} from "./subtitles";

export type TedTalk = {
  title: string;
  speaker: string;
  /** 影片優先用 HLS：字幕就是從同一個 HLS 串流抓的，時間軸一致（mp4 前面可能多了片頭，會整段錯開）。 */
  video: { type: "mp4" | "hls"; url: string; fallback: string | null } | null;
  youtube: string | null;
  cues: Cue[];
  languages: string[];
  chinese: string | null;
  /** 診斷用：英文字幕第一個片段的 X-TIMESTAMP-MAP */
  subtitleTimestampMap: string | null;
};

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

// TED 內容不常變，快取一天，減少每次開播放器都重抓
async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA }, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}：${url}`);
  return res.text();
}

export function normalizeTedUrl(input: string): string {
  const u = new URL(input.trim());
  if (!/(^|\.)ted\.com$/.test(u.hostname)) throw new Error("不是 ted.com 的網址");
  const m = u.pathname.match(/\/talks\/(?:lang\/[^/]+\/)?([\w-]+)/);
  if (!m) throw new Error("網址裡找不到 /talks/…");
  return `https://www.ted.com/talks/${m[1]}`;
}

async function fetchTrack(track: SubtitleTrack): Promise<{ cues: Cue[]; map: string | null }> {
  const body = await get(track.uri);
  // 有些字幕軌直接就是 .vtt，有些是再一層的播放清單
  if (body.trimStart().startsWith("WEBVTT")) return { cues: parseVtt(body), map: parseTimestampMap(body) };
  const segments = parseMediaSegments(body, track.uri);
  const parts = await Promise.all(segments.map(get));
  return { cues: dedupeCues(parts.flatMap(parseVtt)), map: parts[0] ? parseTimestampMap(parts[0]) : null };
}

export async function loadTedTalk(url: string): Promise<TedTalk> {
  const video = parseTedPage(await get(normalizeTedUrl(url)));
  let cues: Cue[] = [];
  let languages: string[] = [];
  let chinese: string | null = null;
  let subtitleTimestampMap: string | null = null;

  if (video.hls) {
    const tracks = parseMasterSubtitles(await get(video.hls), video.hls);
    languages = tracks.map((t) => t.language);
    const en = pickEnglish(tracks);
    const zh = pickChinese(tracks);
    if (en) {
      const [enTrack, zhCues] = await Promise.all([
        fetchTrack(en),
        zh ? fetchTrack(zh).then((t) => t.cues).catch(() => [] as Cue[]) : ([] as Cue[]),
      ]);
      cues = zhCues.length ? mergeBilingual(enTrack.cues, zhCues) : enTrack.cues;
      chinese = zhCues.length && zh ? zh.language : null;
      subtitleTimestampMap = enTrack.map;
    }
  }

  return {
    title: video.title,
    speaker: video.speaker,
    video: video.hls
      ? { type: "hls", url: video.hls, fallback: video.mp4 }
      : video.mp4
        ? { type: "mp4", url: video.mp4, fallback: null }
        : null,
    youtube: video.youtube,
    cues,
    languages,
    chinese,
    subtitleTimestampMap,
  };
}
