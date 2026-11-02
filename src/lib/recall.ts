// 單字・漢字・N3・文型的記憶測驗：看題目寫答案，交給 AI 批改（不再翻卡自評）
import type { GrammarItem, KanjiItem, N3WordItem, VocabItem } from "./types";

export type RecallItem = N3WordItem | GrammarItem | VocabItem | KanjiItem;

export type RecallQuestion = {
  /** 卡片上的大字 */
  cue: string;
  cueLang: "ja" | "en";
  /** 要回答什麼 */
  ask: string;
  placeholder: string;
  /** 給 AI 的題目與參考答案 */
  question: string;
  reference: string;
};

const isKana = (s: string) => /^[぀-ヿー・〜～\s]+$/.test(s);

export function recallQuestion(item: RecallItem, mode?: "reading" | "meaning"): RecallQuestion {
  if (item.kind === "kanji") {
    const readings = [item.on && `音読み：${item.on}`, item.kun && `訓読み：${item.kun}`].filter(Boolean).join("／");
    return {
      cue: item.kanji,
      cueLang: "ja",
      ask: "寫一個讀音和中文意思",
      placeholder: "例：カ うた 歌、唱",
      question: `漢字「${item.kanji}」的讀音（音読み或訓読み，寫一個以上）和中文意思`,
      reference: `${readings}／意思：${item.meaning}`,
    };
  }
  if (item.kind === "grammar") {
    return {
      cue: item.pattern,
      cueLang: "ja",
      ask: "寫出意思或用法（中文說明或造一個例句都可以）",
      placeholder: "例：表示目的，為了～",
      question: `N3 文型「${item.pattern}」是什麼意思、怎麼用？`,
      reference: [`意思：${item.meaning}`, item.connection && `接續：${item.connection}`].filter(Boolean).join("／"),
    };
  }
  if (item.kind === "vocab" && item.lang === "en") {
    return {
      cue: item.word,
      cueLang: "en",
      ask: "寫出中文意思",
      placeholder: "中文意思",
      question: `英文單字「${item.word}」的中文意思`,
      reference: `意思：${item.meaning}`,
    };
  }
  // 日文單字（單字庫・N3）：整個是假名就只問意思；漢字詞一次只考一項（讀音或意思），依日期輪流
  const kanaOnly = !item.reading || isKana(item.word) || item.word === item.reading;
  const pick = kanaOnly ? "meaning" : (mode ?? recallMode(item.id));
  if (pick === "reading") {
    return {
      cue: item.word,
      cueLang: "ja",
      ask: "寫出讀音（平假名）",
      placeholder: "例：もくひょう",
      question: `日文單字「${item.word}」的讀音（平假名）`,
      reference: `讀音：${item.reading}`,
    };
  }
  return {
    cue: item.word,
    cueLang: "ja",
    ask: "寫出中文意思",
    placeholder: "中文意思",
    question: `日文單字「${item.word}」的中文意思`,
    reference: `意思：${item.meaning}`,
  };
}

/** 漢字詞這次考讀音還是意思：同一個字同一天固定（重新整理不會換題），隔天換另一項 */
export function recallMode(id: string, day = Math.floor(Date.now() / 86_400_000)): "reading" | "meaning" {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) + day) % 2 === 0 ? "reading" : "meaning";
}
