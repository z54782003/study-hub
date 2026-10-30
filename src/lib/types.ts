import type { CalendarEvent } from "./calendar";

export type Link = { title: string; url: string };

export type TodayData = {
  date: string;
  dateLabel: string;
  /** 從「紀錄」點進來看過去某一天（到期複習、TED、閱讀是現在的狀態，不顯示） */
  past: boolean;
  weekend: boolean;
  exams: { date: string; name: string; scope: string; daysLeft: number }[];
  homework: { text: string; due: string; url: string; daysLeft: number }[];
  /** null = 沒有設定 ICAL_URLS */
  calendar: CalendarEvent[] | null;
  /** 今天沒有行程時，往後 14 天內下一個有行程的日子 */
  nextCalendar: { date: string; events: CalendarEvent[] } | null;
  preview:
    | (Link & { lesson: string | null; exam: string | null; grammarTitle: string | null; grammar: string[]; grammarNote: string | null })
    | null;
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
  right: number;
  wrong: number;
};

/** 動詞の形：conj＝寫出某一形，group＝判斷是 G1／G2／G3 */
export type VerbItem = {
  kind: "verb";
  id: string;
  dict: string;
  reading: string;
  meaning: string;
  cls: "五段" | "一段" | "サ変" | "カ変";
  mode: "conj" | "group";
  form: string;
  answer: { word: string; reading: string };
};

export type KanjiItem = {
  kind: "kanji";
  id: string;
  kanji: string;
  on: string;
  kun: string;
  meaning: string;
  /** 例詞：詞｜讀音｜中文 */
  examples: { word: string; reading: string; zh: string }[];
  hint: string;
  confusable: string;
  chapter: string | null;
  status: string | null;
};

export type ReviewItem = QuizItem | N3WordItem | GrammarItem | VocabItem | VerbItem | KanjiItem;

/** 複習頁的出題來源（對應 /api/review 的 query string） */
export type ReviewSource =
  | { src: "due" }
  | { src: "mistakes" }
  | { src: "bank"; level: string | null; lessons: number[]; qtype: string | null; scope: "weak" | "all"; count: number }
  | { src: "vocab"; lang: "ja" | "en"; level: string | null; lessons: number[]; count: number; section?: string; cefr?: string; topic?: string; qmode?: "choice" | "fill" }
  | { src: "verb"; forms: string[]; groups: string[]; judge: boolean; count: number }
  | { src: "kanji"; chapters: string[]; count: number };

export type GradeMethod = "自動比對" | "AI" | "自評";

export type AnswerPayload = {
  kind: ReviewItem["kind"];
  id: string;
  correct: boolean;
  /** 題庫題：使用者寫的答案、批改方式與 AI 評語（寫進作答紀錄） */
  answer?: string;
  method?: GradeMethod;
  feedback?: string;
  /** 動詞の形：題目與正確答案由前端產生，直接寫進作答紀錄 */
  prompt?: string;
  reference?: string;
};

export type GradeResult = {
  correct: boolean | null;
  method: GradeMethod;
  feedback: string;
  suggestion: string;
  /** AI 批改失敗的原因（顯示給使用者） */
  error?: string;
};
