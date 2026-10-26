import type { CalendarEvent } from "./calendar";

export type Link = { title: string; url: string };

export type TodayData = {
  date: string;
  dateLabel: string;
  weekend: boolean;
  exams: { date: string; name: string; scope: string; daysLeft: number }[];
  homework: { text: string; due: string; url: string; daysLeft: number }[];
  /** null = 沒有設定 ICAL_URLS */
  calendar: CalendarEvent[] | null;
  preview: (Link & { lesson: string | null; exam: string | null; grammar: string[] }) | null;
  n3: { count: number; grammar: { name: string; url: string | null }[] } | null;
  classNote: (Link & { status: string | null; summary: string; homework: string }) | null;
  review: { quiz: number; n3: number; grammar: number };
  ted: (Link & { progress: string | null }) | null;
  books: (Link & { type: string | null })[];
  errors: string[];
};

export type QuizItem = {
  kind: "quiz";
  id: string;
  prompt: string;
  qtype: string | null;
  answer: string;
  explanation: string;
  lastResult: string | null;
  /** 最近一次答錯時寫的答案 */
  myAnswer: string;
  lastTested: string | null;
};

export type N3WordItem = {
  kind: "n3";
  id: string;
  word: string;
  reading: string;
  meaning: string;
  pos: string | null;
  note: string;
  level: string | null;
  status: string | null;
  source: "batch" | "due";
};

export type GrammarItem = {
  kind: "grammar";
  id: string;
  pattern: string;
  meaning: string;
  connection: string;
  confusable: string;
  status: string | null;
};

/** 📖 單字庫的字（日文依課次、英文依熟悉度） */
export type VocabItem = {
  kind: "vocab";
  id: string;
  word: string;
  reading: string;
  meaning: string;
  pos: string | null;
  usage: string;
  examples: { ja: string; zh: string }[];
  lesson: string | null;
  lang: "ja" | "en";
  status: string | null;
};

export type ReviewItem = QuizItem | N3WordItem | GrammarItem | VocabItem;

/** 複習頁的出題來源（對應 /api/review 的 query string） */
export type ReviewSource =
  | { src: "due" }
  | { src: "mistakes" }
  | { src: "bank"; level: string | null; lessons: number[]; qtype: string | null; scope: "weak" | "all"; count: number }
  | { src: "vocab"; lang: "ja" | "en"; level: string | null; lessons: number[]; count: number };

export type GradeMethod = "自動比對" | "AI" | "自評";

export type AnswerPayload = {
  kind: ReviewItem["kind"];
  id: string;
  correct: boolean;
  /** 題庫題：使用者寫的答案、批改方式與 AI 評語（寫進作答紀錄） */
  answer?: string;
  method?: GradeMethod;
  feedback?: string;
};

export type GradeResult = {
  correct: boolean | null;
  method: GradeMethod;
  feedback: string;
  suggestion: string;
  /** AI 批改失敗的原因（顯示給使用者） */
  error?: string;
};
