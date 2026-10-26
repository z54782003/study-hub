// 題庫答案的自動比對：先列出所有可接受的寫法，對上任何一個就算對；對不上才交給 AI。

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";
const PAREN = /[（(]([^）)]*)[）)]/g;
const KANJI_WITH_READING = /([\p{Script=Han}々]+)[（(]([\p{Script=Hiragana}ー]+)[）)]/gu;

/** 比對前的正規化：全形轉半形、去空白與標點、圈號轉數字、英文小寫。不轉換平假名／片假名（片假名寫成平假名算錯）。 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[①-⑩]/g, (c) => String(CIRCLED.indexOf(c) + 1))
    .replace(/[\s　。、，,．.!！?？「」『』・〜~:：;；"'“”‘’]/g, "")
    .toLowerCase();
}

/** 括號內容是不是「說明」而不是另一種答案（有＝、：、中文說明用語，或太長） */
function isExplanation(inner: string): boolean {
  return /[＝=：:]|表示|意思|用法|搭配/.test(inner) || inner.length > 24;
}

/** 從題庫的「正確答案」展開所有可接受的寫法（已正規化）。 */
export function acceptableAnswers(correct: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const n = normalizeAnswer(s);
    if (n) out.add(n);
  };

  for (const alt of correct.split(/[／/|｜]|\s或\s/)) {
    const core = alt.replace(PAREN, "").trim(); // 去掉所有括號：「黄色（きいろ）」→「黄色」
    add(core);
    add(alt.replace(KANJI_WITH_READING, "$2").replace(PAREN, "")); // 漢字換成讀音：「黄色（きいろ）」→「きいろ」
    for (const m of alt.matchAll(PAREN)) if (!isExplanation(m[1])) add(m[1]); // 括號裡的另一種寫法：「さし（さす）」→「さす」

    // 選擇題：「② 悪い」→ 也接受「②」「2」「悪い」
    // 只有圈號，或「數字／a–d＋分隔符號」才當選項編號，避免「3時」被當成選 3
    const opt = core.match(/^([①-⑩])\s*(.*)$/u) ?? core.match(/^([0-9a-dA-D])[\s.)）．:：]+(.+)$/u);
    if (opt) {
      add(opt[1]);
      if (opt[2]) add(opt[2]);
    }
  }
  return [...out];
}

export function autoGrade(userAnswer: string, correct: string): boolean {
  const u = normalizeAnswer(userAnswer);
  return u.length > 0 && acceptableAnswers(correct).includes(u);
}

export type Choice = { key: string; text: string };

/**
 * 從題目拆出選項：「顔色が（　）ですね。 ①いい ②悪い ③高い（心配するとき）」
 * → 題幹＋[①いい, ②悪い, ③高い]，最後一個選項後面的括號提示移回題幹。少於 2 個選項回傳 null（改用打字）。
 */
export function parseChoices(prompt: string): { stem: string; hint: string; options: Choice[] } | null {
  const parts = prompt.split(/(?=[①-⑩])/u);
  if (parts.length < 3) return null;
  const options: Choice[] = parts.slice(1).map((p) => ({ key: p[0], text: p.slice(1).trim() }));
  let hint = "";
  const last = options[options.length - 1];
  const m = last.text.match(/^(.*?)\s*[（(]([^）)]*)[）)]\s*$/u);
  if (m && m[1]) {
    last.text = m[1];
    hint = m[2];
  }
  if (options.some((o) => !o.text)) return null;
  return { stem: parts[0].trim(), hint, options };
}

/** 選擇題：只要正確答案能對到某個選項就直接判定；對不到任何選項（資料寫法特殊）回傳 null 交給 AI。 */
export function gradeChoice(choice: Choice, options: Choice[], correct: string): boolean | null {
  const ok = acceptableAnswers(correct);
  const matches = (o: Choice) => [o.key, o.text, `${o.key}${o.text}`].some((s) => ok.includes(normalizeAnswer(s)));
  if (!options.some(matches)) return null;
  return matches(choice);
}
