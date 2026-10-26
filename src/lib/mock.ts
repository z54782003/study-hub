// 本機預覽用的假資料（MOCK=1 且沒有 NOTION_TOKEN 時才會用到）。
import { EXAMS } from "./config";
import { diffDays, formatJP, isWeekend } from "./dates";
import type { ReviewItem, TodayData } from "./types";

export function mockToday(day: string): TodayData {
  return {
    date: day,
    dateLabel: formatJP(day),
    weekend: isWeekend(day),
    exams: EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 7),
    preview: { title: "10/27（火）預習｜L3 ST2", url: "#" },
    n3: { count: 38, grammar: [{ name: "〜たばかり", url: "#" }] },
    classNote: { title: "10/27（火）できる L3｜〜ようと思います", url: "#", status: "未整理" },
    review: { quiz: 20, n3: 20, grammar: 2 },
    ted: { title: "How to make stress your friend", url: "#", progress: "今天做" },
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
    },
    {
      kind: "quiz",
      id: "q2",
      prompt: "B：雨が（　）そうです。（看起來快下雨了）",
      qtype: "B 文法填空",
      answer: "降り",
      explanation: "動詞ます形去ます＋そうです＝看起來快要…",
      lastResult: "— 未作答",
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
