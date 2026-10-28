// 發音：用手機／瀏覽器內建語音（iPhone 的日文 Kyoko／O-ren、英文 Samantha 等），免費、可離線。
// 日文一律念假名讀音，避免語音把漢字念錯（今日→こんにち）。

export type SpeechLang = "ja" | "en";

/** 讀音欄可能是「よみます（読む）」「あそびます／あそぶ」「う.まれる・い.きる」，整理成可以念的假名 */
export function speakableJa(reading: string, fallback = ""): string {
  const first = reading
    .replace(/[（(［\[][^）)］\]]*[）)］\]]/g, "")
    .split(/[／/・、,]/)[0]
    .replace(/[.\-〜～~\s]/g, "")
    .trim();
  return first || fallback.replace(/[（(［\[][^）)］\]]*[）)］\]]/g, "").replace(/[〜～~]/g, "").trim();
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// 依序挑比較自然的語音（裝置上有才會用到）
const PREFERRED: Record<SpeechLang, RegExp[]> = {
  ja: [/O-ren.*(Premium|Enhanced)/i, /Kyoko.*(Premium|Enhanced)/i, /Google 日本語/i, /Kyoko/i, /O-ren/i, /Otoya/i],
  en: [/(Ava|Zoe|Evan|Samantha).*(Premium|Enhanced)/i, /Google US English/i, /Samantha/i, /Alex/i],
};

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  for (const re of PREFERRED[lang]) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices.find((v) => v.lang.toLowerCase() === (lang === "ja" ? "ja-jp" : "en-us")) ?? voices[0];
}

/** 念一段文字；再按一次會從頭念（先停掉正在念的） */
/** 例句裡的振り仮名「通（かよ）って」：把漢字換成標好的讀音再唸，不讓語音自己猜（通って→とおって）；也不會唸兩次 */
export function stripReadings(text: string): string {
  return text
    .replace(/[\u4e00-\u9fff々〆ヶ]+[（(]([\u3040-\u30ffー・\s]+)[）)]/g, "$1")
    .replace(/[（(][\u3040-\u30ffー・\s]+[）)]/g, "");
}

export function speak(text: string, lang: SpeechLang, rate = lang === "ja" ? 0.9 : 0.95) {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(lang === "ja" ? stripReadings(text) : text);
  u.lang = lang === "ja" ? "ja-JP" : "en-US";
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}

// 有些瀏覽器第一次 getVoices() 是空的，先觸發載入
if (canSpeak()) window.speechSynthesis.getVoices();
