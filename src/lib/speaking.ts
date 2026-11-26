// 口說練習（言ってみよう）：Notion「口說練習（言ってみよう）」資料庫，一筆＝課本的一個題組。
// 「解答」欄：一題一段（空行分隔），開頭「①」「②」…，照課本提示自己寫的加「（自編）」；一行一句。

export type SpeakingItem = { label: string; own: boolean; lines: string[] };

export type SpeakingSet = {
  id: string;
  lesson: string;
  st: string;
  no: string;
  page: number | null;
  image: { url: string; expires: string | null } | null;
  items: SpeakingItem[];
  note: string;
};

const LABEL = /^([①-⑳])\s*(（自編）)?\s*/;

/** 「解答」欄拆成一題一題 */
export function parseAnswers(text: string): SpeakingItem[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines) => {
      const m = lines[0].match(LABEL);
      if (!m) return { label: "", own: false, lines };
      const rest = lines[0].slice(m[0].length);
      return { label: m[1], own: !!m[2], lines: rest ? [rest, ...lines.slice(1)] : lines.slice(1) };
    });
}

/** 「Ａ：こちらに…」→ 說話的人和台詞；「（或）Ｂ：…」標成另一種說法 */
export function splitLine(line: string): { speaker: string; text: string; alt: boolean } {
  const alt = /^（或）/.test(line);
  const l = line.replace(/^（或）\s*/, "");
  const m = l.match(/^([Ａ-ＺA-Z])\s*[：:]\s*(.*)$/);
  return m ? { speaker: m[1], text: m[2], alt } : { speaker: "", text: l, alt };
}

/** 課次排序：「初中級 L9」→ 9 */
export const lessonNo = (lesson: string) => Number(lesson.match(/L(\d+)/)?.[1] ?? 0);
