import { describe, expect, it } from "vitest";
import {
  cleanCueText,
  dedupeCues,
  mergeBilingual,
  parseMasterSubtitles,
  parseMediaSegments,
  parseTedPage,
  parseTimestampMap,
  parseVtt,
  pickChinese,
  pickEnglish,
} from "./subtitles";

const VTT = `WEBVTT
X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

1
00:00:12.820 --> 00:00:16.010 align:middle line:90%
I have a confession to make,

2
00:00:16.010 --> 00:01:18.250
but first, I want you<br/>to make a <i>little</i> confession &amp; more.
`;

describe("parseVtt", () => {
  it("parses cues, strips tags and entities", () => {
    expect(parseVtt(VTT)).toEqual([
      { start: 12.82, end: 16.01, text: "I have a confession to make," },
      { start: 16.01, end: 78.25, text: "but first, I want you to make a little confession & more." },
    ]);
  });
  it("handles mm:ss timestamps and CRLF", () => {
    expect(parseVtt("WEBVTT\r\n\r\n01:02.500 --> 01:04.000\r\nHello\r\n")).toEqual([{ start: 62.5, end: 64, text: "Hello" }]);
  });
  it("reads X-TIMESTAMP-MAP for diagnostics", () => {
    expect(parseTimestampMap(VTT)).toBe("MPEGTS:900000,LOCAL:00:00:00.000");
    expect(parseTimestampMap("WEBVTT\n\n")).toBeNull();
  });
  it("decodes numeric entities", () => {
    expect(cleanCueText("it&#39;s &#x2014; fine")).toBe("it's — fine");
  });
});

describe("cue merging", () => {
  it("dedupes cues repeated across HLS segments", () => {
    const c = { start: 1, end: 2, text: "a" };
    expect(dedupeCues([{ start: 3, end: 4, text: "b" }, c, { ...c }])).toEqual([c, { start: 3, end: 4, text: "b" }]);
  });
  it("attaches Chinese by time overlap", () => {
    const en = [
      { start: 0, end: 2, text: "Hello" },
      { start: 2, end: 4, text: "World" },
      { start: 10, end: 11, text: "Alone" },
    ];
    const zh = [
      { start: 0.1, end: 2.1, text: "你好" },
      { start: 2.1, end: 4, text: "世界" },
    ];
    expect(mergeBilingual(en, zh).map((c) => c.zh)).toEqual(["你好", "世界", undefined]);
  });
});

describe("HLS playlists", () => {
  const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="en",URI="subtitles/en/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="中文 (繁體)",LANGUAGE="zh-TW",URI="https://hls.ted.com/x/subtitles/zh-tw/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="中文 (简体)",LANGUAGE="zh-cn",URI="subtitles/zh-cn/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",LANGUAGE="en",URI="audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1000000,SUBTITLES="subs"
v1.m3u8`;
  const tracks = parseMasterSubtitles(master, "https://hls.ted.com/project_masters/123/manifest.m3u8?a=1");

  it("reads subtitle tracks and resolves relative URIs", () => {
    expect(tracks.map((t) => t.language)).toEqual(["en", "zh-tw", "zh-cn"]);
    expect(tracks[0].uri).toBe("https://hls.ted.com/project_masters/123/subtitles/en/index.m3u8");
  });
  it("prefers Traditional Chinese", () => {
    expect(pickChinese(tracks)?.language).toBe("zh-tw");
    expect(pickChinese(tracks.filter((t) => t.language !== "zh-tw"))?.language).toBe("zh-cn");
    expect(pickEnglish(tracks)?.language).toBe("en");
  });
  it("lists media segments", () => {
    const media = "#EXTM3U\n#EXT-X-TARGETDURATION:600\n#EXTINF:600,\nseg0.vtt\n#EXTINF:120,\nseg1.vtt\n#EXT-X-ENDLIST\n";
    expect(parseMediaSegments(media, "https://h.ted.com/s/en/index.m3u8")).toEqual([
      "https://h.ted.com/s/en/seg0.vtt",
      "https://h.ted.com/s/en/seg1.vtt",
    ]);
  });
});

describe("parseTedPage", () => {
  const page = (videoData: unknown) =>
    `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { videoData } } })}</script></html>`;

  it("reads resources from videoPlayerData (object form, like yt-dlp 2026.10)", () => {
    const v = parseTedPage(
      page({
        id: "86532",
        title: "How to break down barriers",
        presenterDisplayName: "Candace Parker",
        duration: 679,
        videoPlayerData: {
          resources: {
            hls: { stream: "https://hls.ted.com/project_masters/1/manifest.m3u8" },
            h264: [
              { file: "https://py.tedcdn.com/a-320k.mp4", bitrate: 320 },
              { file: "https://py.tedcdn.com/a-950k.mp4", bitrate: 950 },
              { file: "https://py.tedcdn.com/a-1500k.mp4", bitrate: 1500 },
            ],
          },
        },
      }),
    );
    expect(v).toMatchObject({ id: "86532", speaker: "Candace Parker", mp4: "https://py.tedcdn.com/a-950k.mp4" });
    expect(v.hls).toContain("manifest.m3u8");
  });
  it("accepts the older JSON-string playerData and YouTube-only talks", () => {
    const v = parseTedPage(page({ id: 1, title: "t", playerData: JSON.stringify({ external: { service: "YouTube", code: "abc" } }) }));
    expect(v).toMatchObject({ hls: null, mp4: null, youtube: "abc" });
  });
  it("explains when the page structure changed", () => {
    expect(() => parseTedPage("<html></html>")).toThrow(/__NEXT_DATA__/);
  });
});
