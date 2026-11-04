// 發音：用手機／瀏覽器內建語音（iPhone 的日文 Kyoko／O-ren、英文 Samantha 等），免費、可離線。
// 日文一律念假名讀音，避免語音把漢字念錯（今日→こんにち）。

export type SpeechLang = "ja" | "en";

/**
 * 單字的發音。有兩個以上漢字的詞（駐車・する、お好み焼き、髪の毛）照寫的唸：只給假名時語音判斷不出是哪個詞，
 * 音調會跑掉、詞中間還會停頓。單一漢字、讀法特殊的詞、沒有漢字的才用讀音欄的假名。
 */
export function speakableJa(reading: string, fallback = ""): string {
  const word = fallback.replace(/[（(［\[][^）)］\]]*[）)］\]]/g, "").replace(/[・〜～~\s]/g, "");
  const kanji = word.match(/[\u4e00-\u9fff々]/g) ?? [];
  const special = [...SPECIAL].some((w) => word.includes(w));
  if (!WORD_KANA.has(word) && (writtenOk(word, kanji.length, special) || KEEP_ONE.has(word))) return word;
  return readingKana(reading, fallback);
}

/** 單字按鈕照漢字送會念錯高低音、例句裡照漢字念卻是對的詞：只有單字按鈕改念讀音（例句不變） */
const WORD_KANA = new Set("学生証 自分".split(" "));

/** 讀音開頭是「は」「へ」的（はたち、歯（は））換成片假名：平假名的話語音會當成助詞唸成 wa／e */
const safeKana = (kana: string) => (/^[はへ]/.test(kana) ? kana.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)) : kana);

/** 例句要照寫的唸的單字：只有單字按鈕也照寫的唸時才保留（不然兩邊不一致） */
export function keepWordJa(word: string): string {
  const w = word.replace(/[（(［\[][^）)］\]]*[）)］\]]/g, "").replace(/[・〜～~\s]/g, "").replace(/する$/, "");
  const special = [...SPECIAL].some((x) => w.includes(x));
  return writtenOk(w, (w.match(/[\u4e00-\u9fff々]/g) ?? []).length, special) ? w : "";
}

/**
 * 照寫的唸比較準的詞：兩個以上漢字（駐車する、お好み焼き），或假名開頭的複合詞（たこ焼き、お茶）。
 * 單一漢字開頭的動詞・形容詞（通う、着く、高い）語音常猜錯讀法，不算。
 */
function writtenOk(word: string, kanjiCount: number, special: boolean): boolean {
  if (special || !kanjiCount || !/^[\u3040-\u309f\u4e00-\u9fff々]+$/.test(word)) return false;
  return kanjiCount > 1 || /^[\u3040-\u309f]/.test(word);
}

/** 讀音欄可能是「よみます（読む）」「あそびます／あそぶ」「う.まれる・い.きる」，整理成可以念的假名 */
export function readingKana(reading: string, fallback = ""): string {
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
  // 英文用英式發音（單字庫是英式拼法）
  en: [/(Daniel|Kate|Serena|Jamie|Stephanie|Arthur).*(Premium|Enhanced)/i, /Google UK English/i, /Daniel/i, /Kate/i, /Serena/i, /Arthur/i],
};

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis.getVoices();
  // 英文先找英國腔（en-GB），沒有才用其他英文語音
  const gb = lang === "en" ? all.filter((v) => /^en[-_]gb/i.test(v.lang)) : [];
  const voices = gb.length ? gb : all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  for (const re of PREFERRED[lang]) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices.find((v) => v.lang.toLowerCase().replace("_", "-") === (lang === "ja" ? "ja-jp" : "en-gb")) ?? voices[0];
}

/** 念一段文字；再按一次會從頭念（先停掉正在念的） */
const K = "[\\u4e00-\\u9fff々〆ヶ]+[（(][\\u3040-\\u30ffー・\\s]+[）)]";
// 複合詞中間是連用形的い段・え段假名（お好み焼き、締め切り、申し込む）、っ（引っ越す）或の（髪の毛）；
// 助詞（に、で、へ…）和う段結尾（飛ぶ夢：ぶ 是動詞結束）就斷開
const LINK = "[いきぎしじちぢひびぴみりえけげせぜねべぺめれっの]";
const WORD_CHAIN = new RegExp(`[おご]?${K}(?:${LINK}${K})+`, "g");

// 讀法特殊、語音常唸錯的漢字詞：照標的讀音唸（見学会：語音會照「学会（がっかい）」唸）
// 中間有「の」但是一個詞的（其他「〇の〇」都當兩個詞）
const NO_WORDS = new Set("髪の毛 目の前 日の出 木の葉 火の元 天の川".split(" "));

// 讀法固定的單一漢字（多半是動詞）：照原字唸。換成假名會和前面的助詞黏在一起（と聞（き）いて → ときいて，被唸成「時、いて」）
// 棚：讀法只有 たな，送假名的話語音會唸成頭高（た↘な），送漢字才是正確的平板
const KEEP_ONE = new Set("聞見書読話飲買待言思動棚".split(""));

const SPECIAL = new Set("今日 明日 昨日 今朝 今年 今夜 一日 二日 一人 二人 大人 上手 下手 部屋 眼鏡 土産 果物 景色 一昨日 明後日 二十日 二十歳 八百屋 紅葉 博士 何人 何日 見学会 丈夫 飲み放題 一万円札 五千円札 千円札".split(" "));

/** SPECIAL 裡漢字夾假名的詞（飲み放題）：例句寫成「飲（の）み放題（ほうだい）」時整個換成讀音 */
const SPECIAL_MIXED: [RegExp, (...m: string[]) => string][] = [...SPECIAL]
  .filter((w) => /[\u3040-\u309f]/.test(w))
  .map((w) => {
    const parts = w.match(/[\u4e00-\u9fff々]+|[^\u4e00-\u9fff々]+/g) ?? [];
    const src = parts.map((x) => (/[\u4e00-\u9fff々]/.test(x) ? `${x}[（(]([\u3040-\u30ffー]+)[）)]` : `(${x})`)).join("");
    return [new RegExp(src, "g"), (_m: string, ...g: string[]) => g.slice(0, parts.length).join("")];
  });

/**
 * 例句裡的振り仮名「通（かよ）って」：括號不唸（不然會唸兩次）。
 * 單一個漢字（通って、止まる、着く）語音常猜錯讀法，換成標好的讀音；
 * 兩個字以上的詞（時計、電車）保留漢字，語調比較自然，也不會在詞中間停頓。
 * 換成假名時，緊接在後面的助詞「は」「へ」照發音寫成「わ」「え」（語音分不出是助詞）。
 */
/** 「ご飯（ごはん）」「お湯（おゆ）」：讀音把前面的 お／ご 也寫進去了，拿掉重複的那個（→ ご飯（はん）） */
export function fixPrefixReading(text: string): string {
  return text.replace(/([おご])([\u4e00-\u9fff々〆ヶ]+)([（(])\1([\u3040-\u30ffー・]+)([）)])/g, "$1$2$3$4$5");
}

export function stripReadings(text: string, keep = ""): string {
  text = fixPrefixReading(text);
  // 例句裡的單字本身：單字按鈕照寫的唸，例句也照寫的唸，兩邊才一致（たこ焼（や）き → たこ焼き）
  if (keep) {
    const pattern = [...keep].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/[\u4e00-\u9fff々]/.test(c) ? "(?:[（(][\u3040-\u30ffー・\\s]+[）)])?" : "")).join("");
    text = text.replace(new RegExp(pattern, "g"), keep);
  }
  for (const [re, kana] of SPECIAL_MIXED) text = text.replace(re, kana);
  return text
    // 一個詞裡有好幾個標了讀音的漢字（お好（この）み焼（や）き、髪（かみ）の毛（け））：整個詞照漢字唸，不拆成假名
    .replace(WORD_CHAIN, (m) => {
      const plain = m.replace(/[（(][\u3040-\u30ffー・\s]+[）)]/g, "");
      // 「の」連起來的只有確定是一個詞的才合併（髪の毛）；「棚の上」「昨日の夜」是兩個詞，各自照讀音唸
      // 「少し」是副詞，不和後面的詞合在一起（少（すこ）し悲（かな）しく）
      return (/の/.test(plain) && !NO_WORDS.has(plain)) || /^少[（(]すこ[）)]し/.test(m) ? m : plain;
    })
    .replace(/([\u4e00-\u9fff々〆ヶ]+)[（(]([\u3040-\u30ffー・\s]+)[）)]([はへ])?/g, (_, kanji: string, kana: string, p = "") =>
      ([...kanji].length > 1 && !SPECIAL.has(kanji)) || KEEP_ONE.has(kanji) ? kanji + p : safeKana(kana) + (p === "は" ? "わ" : p === "へ" ? "え" : ""),
    )
    .replace(/[（(][\u3040-\u30ffー・\s]+[）)]/g, "")
    .replace(SAY_AS_RE, (w) => SAY_AS[w]);
}

/** 只寫假名時語音高低音不穩（同一個詞每次念得不一樣）的詞：改送標準漢字寫法，讓語音照辭典的高低音念 */
const SAY_AS: Record<string, string> = { おかわり: "お代わり" };
const SAY_AS_RE = new RegExp(Object.keys(SAY_AS).join("|"), "g");

/** keep：例句裡要照寫的唸的單字（見 stripReadings） */
export function speak(text: string, lang: SpeechLang, rate = lang === "ja" ? 0.9 : 0.95, keep = "") {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(lang === "ja" ? stripReadings(text, keep) : text);
  u.lang = lang === "ja" ? "ja-JP" : "en-GB";
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}

// 有些瀏覽器第一次 getVoices() 是空的，先觸發載入
if (canSpeak()) window.speechSynthesis.getVoices();
