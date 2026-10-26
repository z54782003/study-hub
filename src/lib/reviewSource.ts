// 複習頁出題來源 ⇄ URL query string（伺服器和瀏覽器共用）
import { FORMS, FORM_LABEL } from "./conjugate";
import type { ReviewSource } from "./types";

export const GROUPS = ["G1", "G2", "G3"] as const;

export const LEVELS = ["初級", "初中級"] as const;
export const QTYPES = ["A 單字選擇", "B 文法填空", "C 翻譯", "D 聽寫"] as const;
/** できる日本語：初級 15 課、初中級 15 課 */
export const LESSON_COUNT = 15;

const clampCount = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 50) : 20);

/** 「1,2,3」「1-3」都可以 */
export function parseLessons(s: string | null): number[] {
  if (!s) return [];
  const out = new Set<number>();
  for (const part of s.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    for (let i = Math.min(lo, hi); i <= Math.max(lo, hi); i++) if (i >= 1 && i <= LESSON_COUNT) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

export function parseSource(q: URLSearchParams): ReviewSource {
  const src = q.get("src") ?? q.get("mode");
  const level = LEVELS.find((l) => l === q.get("level")) ?? null;
  const lessons = parseLessons(q.get("lessons"));
  const count = clampCount(Number(q.get("count") ?? 20));
  if (src === "mistakes") return { src: "mistakes" };
  if (src === "bank") {
    const qtype = QTYPES.find((t) => t === q.get("qtype")) ?? null;
    return { src: "bank", level, lessons, qtype, scope: q.get("scope") === "all" ? "all" : "weak", count };
  }
  if (src === "vocab") return { src: "vocab", lang: q.get("lang") === "en" ? "en" : "ja", level, lessons, count };
  if (src === "verb") {
    const list = (k: string) => (q.get(k) ?? "").split(",").filter(Boolean);
    const forms = list("forms").filter((f) => (FORMS as readonly string[]).includes(f));
    const groups = list("groups").filter((g) => (GROUPS as readonly string[]).includes(g));
    return { src: "verb", forms: forms.length ? forms : ["意向"], groups, judge: q.get("judge") === "1", count };
  }
  return { src: "due" };
}

export function sourceQuery(s: ReviewSource): string {
  const q = new URLSearchParams({ src: s.src });
  if (s.src === "bank" || s.src === "vocab") {
    if (s.level) q.set("level", s.level);
    if (s.lessons.length) q.set("lessons", s.lessons.join(","));
    q.set("count", String(s.count));
  }
  if (s.src === "bank") {
    if (s.qtype) q.set("qtype", s.qtype);
    q.set("scope", s.scope);
  }
  if (s.src === "vocab") q.set("lang", s.lang);
  if (s.src === "verb") {
    q.set("forms", s.forms.join(","));
    if (s.groups.length) q.set("groups", s.groups.join(","));
    if (s.judge) q.set("judge", "1");
    q.set("count", String(s.count));
  }
  return q.toString();
}

export function sourceLabel(s: ReviewSource): string {
  if (s.src === "due") return "今日到期";
  if (s.src === "mistakes") return "錯題重測";
  if (s.src === "verb") return `動詞の形・${s.forms.map((f) => FORM_LABEL[f as keyof typeof FORM_LABEL] ?? f).join("・")}`;
  const lessons = s.lessons.length ? `L${s.lessons.join("・")}` : "全部課";
  if (s.src === "vocab") return s.lang === "en" ? "英文單字" : `單字測驗・${s.level ?? ""} ${lessons}`;
  return `題庫・${s.level ?? "全部"} ${lessons}${s.qtype ? `・${s.qtype}` : ""}`;
}

/** 考試範圍「1〜3課 語彙・文法」「4〜6課」「ビジネス 2・7課」→ 課號；看不出來回傳空陣列 */
export function examLessons(scope: string): number[] {
  if (/ビジネス/.test(scope.split("／")[0])) return [];
  const m = scope.match(/(\d+)\s*[〜~～-]\s*(\d+)\s*課/);
  if (m) return parseLessons(`${m[1]}-${m[2]}`);
  const single = scope.match(/^(\d+(?:・\d+)*)課/);
  return single ? parseLessons(single[1].split("・").join(",")) : [];
}
