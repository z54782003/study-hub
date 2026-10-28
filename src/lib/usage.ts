// 單字庫「搭配・用法」欄：「目標を立てる：訂目標／目標を達成する：達成目標」→ 一列一個搭配
// 「・⚠️畑 單獨讀 はたけ…」這種提醒整行一列（note），不拆日文／中文
export type Usage = { ja: string; zh: string; note?: true };

export function parseUsage(s: string): Usage[] {
  return s
    .split(/[／\n]/)
    .map((x) =>
      x
        .trim()
        // 舊資料寫成「・搭配：目標を立てる——訂立目標」：去掉開頭的「・」「搭配：」
        .replace(/^[・•]\s*/, "")
        .replace(/^搭配[：:]\s*/, ""),
    )
    .filter(Boolean)
    .map((x): Usage => {
      if (/^⚠️?/.test(x)) return { ja: x.replace(/^⚠️?\s*/, ""), zh: "", note: true };
      const m = x.match(/^(.+?)\s*(?:[：:＝=]|——|\s[-–—]\s)\s*(.+)$/);
      return m ? { ja: m[1], zh: m[2] } : { ja: x, zh: "" };
    });
}

/** 提醒「相關：落（お）ちる（自）」：括號裡不是讀音（有假名以外的字）的是中文補充，分出來好用不同顏色 */
export function glossParts(text: string): { text: string; zh: boolean }[] {
  return text
    .split(/([（(][^）)]*[^\u3040-\u30ffー・（()）][^）)]*[）)])/)
    .filter(Boolean)
    .map((t) => ({ text: t, zh: /^[（(]/.test(t) && !/^[（(][\u3040-\u30ffー・]+[）)]$/.test(t) }));
}

/** 例句裡把單字本身標出來；找不到就整句一段 */
export function markWord(sentence: string, word: string): { text: string; hit: boolean }[] {
  let w = word.replace(/[（(].*$/, "").trim();
  // 動詞、形容詞在例句裡常變化：找不到就去掉結尾的假名再找（諦める→諦め）
  if (w && !sentence.includes(w) && /[\u3040-\u309f]$/.test(w) && w.length > 1) w = w.slice(0, -1);
  if (!w || !sentence.includes(w)) return [{ text: sentence, hit: false }];
  return sentence.split(w).flatMap((part, i) => (i === 0 ? [{ text: part, hit: false }] : [{ text: w, hit: true }, { text: part, hit: false }])).filter((p) => p.text);
}
