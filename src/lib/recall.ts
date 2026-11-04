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
  // 中文意思就寫著同樣的漢字（夢 → 夢想；夢）：考意思等於送分，改考讀音
  const pick = kanaOnly ? "meaning" : sameAsChinese(item.word, item.meaning) ? "reading" : (mode ?? recallMode(item.id));
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

// 日本新字體 → 繁體（常見的），比對中文意思用
const TRAD: Record<string, string> = Object.fromEntries(
  "学學 証證 気氣 会會 国國 読讀 体體 実實 楽樂 図圖 駅驛 売賣 円圓 写寫 発發 来來 帰歸 歳歲 転轉 変變 広廣 様樣 関關 経經 対對 応應 単單 戦戰 鉄鐵 数數 県縣 区區 辺邊 両兩 済濟 権權 黒黑 薬藥 絵繪 続續 戻戾 払拂 険險 浅淺 価價 伝傳 仏佛 歩步 毎每 険險 験驗 労勞 営營 静靜 鶏雞 稲稻 駆驅 剣劍 誉譽 隣鄰 沢澤 将將 蔵藏 弁辯 声聲 聴聽 窓窗 圧壓 囲圍 竜龍 処處 帯帶 恵惠 権權 歯齒 児兒 桜櫻 涙淚 頼賴 銭錢 斎齋 雑雜 霊靈 塩鹽 庁廳 拡擴 悪惡 亜亞 挙舉 覚覺 観觀 勧勸 姫姬 宝寶 豊豐 満滿 乱亂 礼禮 練練 録錄 湾灣 訳譯 鉱礦 総總 厳嚴 弾彈 断斷 担擔 択擇 沢澤 焼燒 畳疊 縄繩 尽盡 粋粹 酔醉 摂攝 専專 銭錢 層層 装裝 騒騷 増增 臓臟 属屬 堕墮 台臺 滝瀧 胆膽 遅遲 昼晝 鋳鑄 聴聽 鎮鎭 逓遞 点點 灯燈 当當 闘鬥 徳德 独獨 読讀 届屆 弐貳 悩惱 脳腦 廃廢 梅梅 麦麥 発發 抜拔 晩晚 蛮蠻 秘祕 浜濱 瓶瓶 敏敏 侮侮 福福 払拂 並竝 塀塀 餅餠 舗舖 歩步 宝寶 豊豐 翻飜 万萬 黙默 訳譯 薬藥 与與 揺搖 様樣 謡謠 来來 頼賴 欄欄 竜龍 隆隆 虜虜 涼涼 猟獵 緑綠 塁壘 類類 励勵 戻戾 霊靈 齢齡 暦曆 歴歷 恋戀 炉爐 労勞 楼樓 郎郞 禄祿 湾灣 説說 鉄鐵 転轉 伝傳 図圖 茶茶 時時 計計 電電 車車 間間 話話 語語 長長 門門 開開 閉閉 東東 書書 買買 飯飯 館館 魚魚 鳥鳥 馬馬 風風 飛飛 題題 願願 類類 顔顏 頭頭 線線 細細 終終 結結 経經 紙紙 続續 選選 達達 運運 進進 遠遠 過過 連連 遊遊 週週 道道 適適 違違 険險 陽陽 隊隊 階階 際際 障障 雲雲 電電 震震 霧霧 静靜 非非 面面 音音 響響 頂頂 順順 預預 領領 額額 風風 食食 飲飲 養養 館館 首首 香香 駐駐 験驗 騒騷 髪髮 鬼鬼 魅魅 鳴鳴 麺麵 黄黃 齢齡 亀龜"
    .split(" ")
    .map((p) => [p[0], p[1]]),
);

/** 單字裡的漢字全部出現在中文意思裡（新字體換成繁體也算）：中文母語看字就知道意思 */
export function sameAsChinese(word: string, meaning: string): boolean {
  const kanji = word.replace(/[（(][^）)]*[）)]/g, "").match(/[\u4e00-\u9fff々]/g);
  if (!kanji) return false;
  return kanji.every((k) => k === "々" || meaning.includes(k) || meaning.includes(TRAD[k] ?? k));
}
