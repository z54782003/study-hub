import "server-only";
import {
  dedupeCues,
  mergeBilingual,
  parseMasterSubtitles,
  parseMediaSegments,
  parseTedPage,
  parseVtt,
  pickChinese,
  pickEnglish,
  type Cue,
  type SubtitleTrack,
} from "./subtitles";

export type TedTalk = {
  title: string;
  speaker: string;
  video: { type: "mp4" | "hls"; url: string } | null;
  youtube: string | null;
  cues: Cue[];
  languages: string[];
  chinese: string | null;
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

async function fetchTrack(track: SubtitleTrack): Promise<Cue[]> {
  const body = await get(track.uri);
  // 有些字幕軌直接就是 .vtt，有些是再一層的播放清單
  if (body.trimStart().startsWith("WEBVTT")) return parseVtt(body);
  const segments = parseMediaSegments(body, track.uri);
  const parts = await Promise.all(segments.map(get));
  return dedupeCues(parts.flatMap(parseVtt));
}

export async function loadTedTalk(url: string): Promise<TedTalk> {
  const video = parseTedPage(await get(normalizeTedUrl(url)));
  let cues: Cue[] = [];
  let languages: string[] = [];
  let chinese: string | null = null;

  if (video.hls) {
    const tracks = parseMasterSubtitles(await get(video.hls), video.hls);
    languages = tracks.map((t) => t.language);
    const en = pickEnglish(tracks);
    const zh = pickChinese(tracks);
    if (en) {
      const [enCues, zhCues] = await Promise.all([fetchTrack(en), zh ? fetchTrack(zh).catch(() => []) : []]);
      cues = zhCues.length ? mergeBilingual(enCues, zhCues) : enCues;
      chinese = zhCues.length && zh ? zh.language : null;
    }
  }

  return {
    title: video.title,
    speaker: video.speaker,
    video: video.mp4 ? { type: "mp4", url: video.mp4 } : video.hls ? { type: "hls", url: video.hls } : null,
    youtube: video.youtube,
    cues,
    languages,
    chinese,
  };
}
