// 本機預覽用的假資料（MOCK=1 且沒有 NOTION_TOKEN 時才會用到）。
import { EXAMS } from "./config";
import { diffDays, formatJP, isWeekend } from "./dates";
import type { ReviewItem, TodayData } from "./types";
import type { TedTalk } from "./ted";

export function mockToday(day: string): TodayData {
  return {
    date: day,
    dateLabel: formatJP(day),
    weekend: isWeekend(day),
    exams: EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 7),
    homework: [{ text: "文法ノート 練習8–10（p.19–22）", due: "2026-10-28", url: "#", daysLeft: 1 }],
    calendar: [
      { title: "ISI 上課", allDay: false, start: "13:00", end: "16:10", location: "ISI 307", sortKey: 2 },
      { title: "牙醫", allDay: false, start: "09:30", end: "10:30", location: "新宿", sortKey: 1 },
    ].sort((a, b) => a.sortKey - b.sortKey),
    preview: {
      title: "10/27（火）預習｜L3 ST2",
      url: "#",
      lesson: "できる日本語 初中級 第3課「私の目標」，今天預期進入 ST3-2「夢に向かって」（本冊 p.48–51）。",
      exam: "10/27（二）動詞の形テスト：意向形。",
      grammar: ["① Nのために／V辞書形ために、〜", "② 〜んですか／〜んです", "③ 〜なければなりません"],
    },
    n3: { count: 38, grammar: [{ name: "〜たばかり", url: "#" }] },
    classNote: null,
    review: { quiz: 20, n3: 20, grammar: 2 },
    ted: { title: "How to make stress your friend", url: "/ted/mock", progress: "今天做" },
    books: [
      { title: "コンビニ人間", url: "#", type: "Graded reader" },
      { title: "Atomic Habits", url: "#", type: "Book" },
    ],
    errors: [],
  };
}

export function mockReview(): ReviewItem[] {
  return [
    {
      kind: "quiz",
      id: "q1",
      prompt: "C2：請翻譯成日文：「背新單字很辛苦。」",
      qtype: "C 翻譯",
      answer: "新しい単語を覚えるのは大変です。",
      explanation: "「〜のは大変です」：把動作名詞化後評價。覚える（おぼえる）＝記住。",
      lastResult: "❌ 錯",
      myAnswer: "新しい単語を覚えるのが大変です。",
      lastTested: "2026-10-26",
    },
    {
      kind: "quiz",
      id: "q2",
      prompt: "B：雨が（　）そうです。（看起來快下雨了）",
      qtype: "B 文法填空",
      answer: "降り",
      explanation: "動詞ます形去ます＋そうです＝看起來快要…",
      lastResult: "— 未作答",
      myAnswer: "",
      lastTested: null,
    },
    {
      kind: "quiz",
      id: "q3",
      prompt: "顔色が（　）ですね。大丈夫ですか。 ①いい ②悪い ③高い（心配するとき）",
      qtype: "A 單字選擇",
      answer: "② 悪い（顔色が悪い＝臉色不好）",
      explanation: "顔色（かおいろ）與「悪い／いい」搭配，表示氣色。",
      lastResult: "❌ 錯",
      myAnswer: "① いい",
      lastTested: "2026-10-25",
    },
    {
      kind: "n3",
      id: "n1",
      word: "経験",
      reading: "けいけん",
      meaning: "經驗",
      pos: "名詞・する動詞",
      note: "",
      level: "N3",
      status: "學習中",
      source: "due",
    },
    {
      kind: "n3",
      id: "n2",
      word: "締め切り",
      reading: "しめきり",
      meaning: "截止日期",
      pos: "名詞",
      note: "レポートの締め切りは明日だ。",
      level: "N3",
      status: "未學",
      source: "batch",
    },
    {
      kind: "grammar",
      id: "g1",
      pattern: "〜たばかり",
      meaning: "剛…完（主觀上覺得時間很短）",
      connection: "動詞た形＋ばかり",
      confusable: "〜たところ（客觀上剛結束）",
      status: "未學",
    },
  ];
}

export async function mockAnswer(): Promise<void> {}
export async function mockJournal(): Promise<void> {}

// 播放器預覽：用一段公開的測試影片＋假字幕
export function mockTedTalk(): TedTalk {
  const lines: [string, string][] = [
    ["I have a confession to make, but first,", "我要先坦白一件事，但首先，"],
    ["I want you to make a little confession to me.", "我希望你們先對我坦白一件小事。"],
    ["In the past year, I want you to just raise your hand", "在過去一年裡，請舉手"],
    ["if you've experienced relatively little stress.", "如果你經歷的壓力相對較少。"],
    ["Anyone?", "有人嗎？"],
    ["How about a moderate amount of stress?", "那中等程度的壓力呢？"],
    ["Who has experienced a lot of stress?", "誰經歷過很大的壓力？"],
    ["Yeah. Me too.", "對，我也是。"],
  ];
  return {
    title: "How to make stress your friend",
    speaker: "Kelly McGonigal",
    video: process.env.MOCK_HLS_URL
      ? { type: "hls", url: process.env.MOCK_HLS_URL, fallback: process.env.MOCK_VIDEO_URL ?? "/mock.mp4" }
      : { type: "mp4", url: process.env.MOCK_VIDEO_URL ?? "/mock.mp4", fallback: null },
    youtube: null,
    cues: lines.map(([text, zh], i) => ({ start: i * 1.25, end: (i + 1) * 1.25, text, zh })),
    languages: ["en", "zh-tw"],
    chinese: "zh-tw",
    subtitleTimestampMap: null,
  };
}
