import { markWord } from "./usage";
import { fixPrefixReading } from "./speech";

// 「面接（めんせつ）」→ 漢字上方小字讀音（<ruby>）；同時標出例句裡的單字本身
export type RubyPart = { text: string; rt?: string; hit: boolean };

const RUBY = /([一-鿿々〆ヶ]+)[（(]([぀-ヿー・]+)[）)]/g;

/**
 * 「かな（漢字）」反過來寫的答案（② しゅうでん（終電）、だいすき（大好き））改成「漢字（かな）」，好顯示成上方小字讀音。
 * 前後相同的假名（送假名、お）留在括號外：だいすき（大好き）→ 大好（だいす）き、おかねもち（お金持ち）→ お金持（かねも）ち。
 * 拆不開（中間不是純漢字）就照原樣。
 */
export function flipReadings(text: string): string {
  return text.replace(/(^|[^\u3040-\u30ff])([\u3040-\u309fー]+)[（(]([^（()）]*[一-鿿々〆ヶ][^（()）]*)[）)]/g, (all, pre: string, kana: string, form: string) => {
    let head = 0;
    while (head < form.length && head < kana.length && form[head] === kana[head] && /[\u3040-\u309f]/.test(form[head])) head++;
    let tail = 0;
    while (tail < form.length - head && tail < kana.length - head && form[form.length - 1 - tail] === kana[kana.length - 1 - tail] && /[\u3040-\u309f]/.test(form[form.length - 1 - tail])) tail++;
    const core = form.slice(head, form.length - tail);
    const rt = kana.slice(head, kana.length - tail);
    if (!core || !rt || !/^[一-鿿々〆ヶ]+$/.test(core)) return all;
    return `${pre}${form.slice(0, head)}${core}（${rt}）${form.slice(form.length - tail)}`;
  });
}

/** 讀音連送假名一起寫的（読む（よむ）、入れる（いれる））改成 読（よ）む，好顯示成上方小字讀音 */
export function fixOkurigana(text: string): string {
  return text.replace(/([一-鿿々〆ヶ]+)([\u3040-\u309f]+)[（(]([\u3040-\u309fー]+)[）)]/g, (all, kanji: string, tail: string, kana: string) =>
    kana.length > tail.length && kana.endsWith(tail) ? `${kanji}（${kana.slice(0, -tail.length)}）${tail}` : all,
  );
}

/** 答案、解析裡的讀音寫法統一成「漢字（かな）」 */
export const normalizeReadings = (text: string) => fixOkurigana(flipReadings(text));

/**
 * 題庫解析：只有「」『』括起來的日文才顯示振假名；括號外是中文說明，讀音括號拿掉
 * （中文字緊貼日文漢字時分不出哪幾個字是日文：「對對方用尊敬語（そんけいご）」）
 */
export function explanationSegments(text: string): { text: string; ruby: boolean }[] {
  const out: { text: string; ruby: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(/[「『][^「」『』]*[」』]/g)) {
    if (m.index > last) out.push({ text: stripReadings(text.slice(last, m.index)), ruby: false });
    out.push({ text: normalizeReadings(m[0]), ruby: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: stripReadings(text.slice(last)), ruby: false });
  return out;
}

const stripReadings = (s: string) => s.replace(/([一-鿿々〆ヶ])[（(][\u3040-\u30ffー・]+[）)]/g, "$1");

/** 句子裡有沒有「漢字（かな）」形式的讀音 */
export const hasReadings = (text: string) => new RegExp(RUBY.source).test(text);

export function rubyParts(text: string, word = ""): RubyPart[] {
  text = fixPrefixReading(text);
  // 1. 拆成「一般文字」和「漢字＋讀音」
  const tokens: { text: string; rt?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(RUBY)) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index) });
    tokens.push({ text: m[1], rt: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last) });

  // 2. 在去掉讀音的句子上找單字的位置
  const plain = tokens.map((t) => t.text).join("");
  const hit: boolean[] = [];
  for (const p of word ? markWord(plain, word) : [{ text: plain, hit: false }]) for (const _ of p.text) hit.push(p.hit);

  // 3. 振り仮名整塊標；一般文字照位置切開
  const out: RubyPart[] = [];
  let pos = 0;
  for (const t of tokens) {
    const chars = [...t.text];
    if (t.rt) out.push({ text: t.text, rt: t.rt, hit: chars.some((_, k) => hit[pos + k]) });
    else
      chars.forEach((c, k) => {
        const h = hit[pos + k] ?? false;
        const prev = out.at(-1);
        if (prev && !prev.rt && prev.hit === h) prev.text += c;
        else out.push({ text: c, hit: h });
      });
    pos += chars.length;
  }
  return out;
}
