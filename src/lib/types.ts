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

export type ReviewItem = QuizItem | N3WordItem | GrammarItem;

export type AnswerPayload = { kind: ReviewItem["kind"]; id: string; correct: boolean };
