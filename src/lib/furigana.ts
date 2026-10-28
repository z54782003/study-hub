import { markWord } from "./usage";

// 「面接（めんせつ）」→ 漢字上方小字讀音（<ruby>）；同時標出例句裡的單字本身
export type RubyPart = { text: string; rt?: string; hit: boolean };

const RUBY = /([一-鿿々〆ヶ]+)[（(]([぀-ヿー・]+)[）)]/g;

export function rubyParts(text: string, word = ""): RubyPart[] {
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
