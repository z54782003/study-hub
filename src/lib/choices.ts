// 單字練習的選擇題回合：日文漢字詞選讀音（干擾選項是長得很像的假名：しゃしん／しやしん／じゃしん），
// 英文和純假名的字選中文意思（干擾選項拿同一回合其他字的意思）。不用 AI，直接比對。
import { readingKana } from "./speech";
import type { RecallItem } from "./recall";

export type Choice = { ask: string; options: string[]; answer: string; lang: "ja" | "zh" };

/** 字串 → 固定的亂數種子（同一題每次打開選項順序一樣） */
function seeded(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>>= 0) % 10000) / 10000;
  };
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 相近假名 ──────────────────────────────────────────

const toHira = (c: string) => (/[ァ-ヶ]/.test(c) ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c);
const likeOrig = (orig: string, c: string) => (/[ァ-ヶ]/.test(orig) ? String.fromCharCode(c.charCodeAt(0) + 0x60) : c);

const DAKU: string[][] = [
  ..."かきくけこさしすせそたてと".split("").map((c) => [c, String.fromCharCode(c.charCodeAt(0) + 1)]),
  ..."はひふへほ".split("").map((c) => [c, String.fromCharCode(c.charCodeAt(0) + 1), String.fromCharCode(c.charCodeAt(0) + 2)]),
];
const SMALL: Record<string, string> = { ゃ: "や", ゅ: "ゆ", ょ: "よ", っ: "つ" };
const BIG = Object.fromEntries(Object.entries(SMALL).map(([s, b]) => [b, s]));
const I_ROW = new Set("きしちにひみりぎじびぴ");
const O_ROW = new Set("こそとのほもよろごぞどぼぽょ");
const U_ROW = new Set("くすつぬふむゆるぐずぶぷゅ");
const E_ROW = new Set("けせてねへめれげぜでべぺ");
const GEMINATE = new Set("かきくけこさしすせそたちつてとぱぴぷぺぽ");

type Edit = "size" | "voice" | "long" | "geminate";
/** 改一個地方就不一樣的讀法：大小字（ゃ↔や）、清濁音（し↔じ、は↔ば↔ぱ）、長音（こ↔こう）、促音（っ） */
function oneEdit(s: string): { kind: Edit; text: string }[] {
  const out: { kind: Edit; text: string }[] = [];
  const cs = [...s];
  const put = (kind: Edit, i: number, rep: string, del = 1) => out.push({ kind, text: [...cs.slice(0, i), rep, ...cs.slice(i + del)].join("") });
  cs.forEach((orig, i) => {
    const c = toHira(orig);
    const prev = i > 0 ? toHira(cs[i - 1]) : "";
    if (SMALL[c]) put("size", i, likeOrig(orig, SMALL[c]));
    if (BIG[c] && I_ROW.has(prev) && c !== "つ") put("size", i, likeOrig(orig, BIG[c]));
    if (c === "つ" && i > 0 && i < cs.length - 1) put("size", i, likeOrig(orig, "っ"));
    for (const set of DAKU) if (set.includes(c)) for (const d of set) if (d !== c) put("voice", i, likeOrig(orig, d));
    // 長音：おう／うう／えい 拿掉，或多加一個
    if (c === "う" && (O_ROW.has(prev) || U_ROW.has(prev))) put("long", i, "");
    else if (c === "い" && E_ROW.has(prev)) put("long", i, "");
    else if (O_ROW.has(c) && toHira(cs[i + 1] ?? "") !== "う") put("long", i + 1, likeOrig(orig, "う"), 0);
    if (c === "っ") put("geminate", i, "");
    else if (i > 0 && GEMINATE.has(c) && prev !== "っ" && prev !== "ん") put("geminate", i, likeOrig(orig, "っ") + orig);
  });
  return out;
}

/** 三個看起來很像、但不對的讀音：先放大小字（しゃ→しや），再輪流拿清濁音、長音、促音 */
export function nearReadings(reading: string, seedText = reading): string[] {
  const rand = seeded(seedText);
  const found: string[] = [];
  const take = (xs: string[]) => {
    for (const x of xs) if (found.length < 3 && x && x !== reading && !found.includes(x)) return void found.push(x);
  };
  const edits = oneEdit(reading);
  const byKind = (k: Edit) => shuffle(edits.filter((e) => e.kind === k).map((e) => e.text), rand);
  const lists = (["size", "voice", "long", "geminate"] as Edit[]).map(byKind);
  for (let round = 0; round < 3 && found.length < 3; round++) for (const l of lists) take(l.slice(round));
  // 還不夠三個：在改過的讀法上再改一次
  if (found.length < 3) take(shuffle(edits.flatMap((e) => oneEdit(e.text).map((x) => x.text)), rand));
  while (found.length < 3) {
    const before = found.length;
    take(shuffle(found.flatMap((f) => oneEdit(f).map((x) => x.text)), rand));
    if (found.length === before) break;
  }
  return found;
}

// ── 出題 ──────────────────────────────────────────────

const hasKanji = (s: string) => /[一-鿿々]/.test(s);
const shortMeaning = (m: string) => m.split(/[；;]/)[0].trim();

/** 這題的選擇題；做不出四個選項就回傳 null（改出填空） */
export function choiceQuestion(item: RecallItem, pool: RecallItem[]): Choice | null {
  if (item.kind !== "vocab" && item.kind !== "n3") return null;
  const rand = seeded(item.id);
  const lang = item.kind === "vocab" ? item.lang : "ja";
  const reading = lang === "ja" ? readingKana(item.reading, "") : "";
  if (lang === "ja" && hasKanji(item.word) && reading && !hasKanji(reading)) {
    const wrong = nearReadings(reading, item.id);
    if (wrong.length < 3) return null;
    return { ask: "選出正確的讀音", options: shuffle([reading, ...wrong], rand), answer: reading, lang: "ja" };
  }
  // 英文、純假名：選中文意思
  const answer = shortMeaning(item.meaning);
  if (!answer) return null;
  const others = [...new Set(pool.filter((p) => p.id !== item.id && (p.kind === "vocab" || p.kind === "n3")).map((p) => shortMeaning(p.meaning)))].filter(
    (m) => m && m !== answer,
  );
  if (others.length < 3) return null;
  return { ask: "選出正確的中文意思", options: shuffle([answer, ...shuffle(others, rand).slice(0, 3)], rand), answer, lang: "zh" };
}
