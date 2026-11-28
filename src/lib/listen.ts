// 聽寫：用單字庫預先產生的發音檔（VOICEVOX）出題，直接比對，不用 AI
// 1. 單字聽寫：聽單字 → 寫假名（讀音）
// 2. 例句填空：例句挖掉這個單字 → 聽整句 → 填假名
import { rubyParts, type RubyPart } from "./furigana";
import type { AudioRef, VocabItem } from "./types";

export type ListenQuestion =
  // say：音檔播不了時給瀏覽器念的文字
  | { type: "word"; audio: AudioRef; say: string; answers: string[]; answer: string }
  | { type: "blank"; audio: AudioRef; say: string; answers: string[]; answer: string; before: RubyPart[]; after: RubyPart[] };

const KANA = /^[぀-ヿー・]+$/;

/** 比對前的正規化：全形半形、空白、標點拿掉（平假名／片假名不互換） */
export const normalizeKana = (s: string) => s.normalize("NFKC").replace(/[\s　。、，,.・「」！？!?〜~]/g, "");

/** 單字可接受的寫法：每個讀音（「ひと／にん」「あう（会う）」）、假名詞本身，漢字照原字寫也算對 */
export function wordAnswers(item: Pick<VocabItem, "word" | "reading">): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const n = normalizeKana(s.replace(/[（(].*?[）)]/g, ""));
    if (n && !n.includes("〜")) out.add(n);
  };
  for (const r of item.reading.split(/[／/、,，;；]|\s+/)) if (KANA.test(normalizeKana(r.replace(/[（(].*?[）)]/g, "")))) add(r);
  add(item.word);
  return [...out];
}

/** 卡片上顯示的正確答案：第一個讀音（假名詞就是單字本身） */
const mainReading = (item: Pick<VocabItem, "word" | "reading">) => {
  const r = item.reading.split(/[／/、,，;；]|\s+/).map((x) => x.replace(/[（(].*?[）)]/g, "").trim()).find((x) => KANA.test(normalizeKana(x)));
  return r || item.word;
};

/** 例句裡找到「完全一樣」的單字（動詞變化過的不算）就挖空；答案是那一段的讀音 */
export function blankExample(item: VocabItem): Extract<ListenQuestion, { type: "blank" }> | null {
  const word = item.word.replace(/[（(].*$/, "").trim();
  if (!word || word.includes("〜")) return null;
  for (const ex of item.examples) {
    if (!ex.audio || !ex.ja) continue;
    const parts = rubyParts(ex.ja, word);
    const first = parts.findIndex((p) => p.hit);
    if (first < 0) continue;
    let end = first;
    while (end + 1 < parts.length && parts[end + 1].hit) end++;
    const hit = parts.slice(first, end + 1);
    if (hit.map((p) => p.text).join("") !== word) continue;
    // 讀音：有振假名的用振假名，假名照寫；漢字沒標讀音就沒辦法出題
    if (hit.some((p) => !p.rt && !KANA.test(p.text))) continue;
    const reading = hit.map((p) => p.rt ?? p.text).join("");
    const answers = [...new Set([normalizeKana(reading), ...wordAnswers(item)])];
    return { type: "blank", audio: ex.audio, say: ex.ja, answers, answer: reading, before: parts.slice(0, first), after: parts.slice(end + 1) };
  }
  return null;
}

/** 這一題考哪一種：單數題考例句填空（做得出來的話），其他考單字聽寫；沒有單字音檔就只能考例句 */
export function listenQuestion(item: VocabItem, index: number): ListenQuestion | null {
  const blank = blankExample(item);
  const word: ListenQuestion | null = item.audio ? { type: "word", audio: item.audio, say: mainReading(item), answers: wordAnswers(item), answer: mainReading(item) } : null;
  if (blank && (index % 2 === 1 || !word)) return blank;
  return word;
}

export const checkListen = (q: ListenQuestion, input: string) => q.answers.includes(normalizeKana(input));
