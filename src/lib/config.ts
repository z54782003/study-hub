// Notion data source IDs（collection://…）。不是秘密，直接寫在這裡；需要時可用環境變數覆寫。
export const DS = {
  quiz: process.env.DS_QUIZ ?? "b6683342-ac8a-4af1-af45-29f7ab54cbd0", // 日文題庫（Quiz Bank）
  vocab: process.env.DS_VOCAB ?? "e4612b22-a490-4ba2-9ef5-11b2f07f8ccb", // 📖 Vocabulary / 單字庫
  n3Words: process.env.DS_N3_WORDS ?? "3bf097c5-7668-8066-9f22-000b84caf01b", // JLPT テスト 単語
  n3Grammar: process.env.DS_N3_GRAMMAR ?? "52c28f1e-4088-493c-b5ca-80b45d62c37e", // N3 文法補強
  isiNotes: process.env.DS_ISI_NOTES ?? "fdd81746-c7ec-4339-b938-6e570c62e9a1", // ISI 課堂筆記＆錄音
  tedLog: process.env.DS_TED_LOG ?? "ed51740b-dabf-4ee8-bb95-9ae17aa531ac", // TED Log
  books: process.env.DS_BOOKS ?? "a73097c5-7668-8295-ab2c-8735d209f19f", // 📕 Books
  journal: process.env.DS_JOURNAL ?? "9f8acad0-843a-443d-bc22-8050e151eae9", // 📔 Journal
  attempts: process.env.DS_ATTEMPTS ?? "0f5829ab-0ceb-4322-823e-71058525a2d4", // 📝 作答紀錄（Study Hub）
  tadokuLog: process.env.DS_TADOKU_LOG ?? "ff956b29-87b5-4995-8026-b2947331d885", // 📚 多読紀錄
  kanji: process.env.DS_KANJI ?? "a05cd8c3-2228-4aca-af1f-d7d6d95f3980", // 🈴 漢字庫（HSJ）
};

// 「每日預習（W3）」父頁，底下一天一頁，標題「MM/DD（曜）預習｜L〇 ST〇」
export const W3_PARENT_PAGE = process.env.W3_PARENT_PAGE ?? "3f2097c576688100bc56d2f56e4d80c7";

// 📼 課文音檔（できる日本語 初中級）：001–124 mp3（檔名就是編號）
export const LESSON_AUDIO_PAGE = process.env.LESSON_AUDIO_PAGE ?? "406097c5-7668-810e-ade7-e0954334c539";

// 🎯 日本語計畫頁：底下「初中級課本索引｜L〇」一課一頁，課文音檔頁從這裡讀課文
export const TEXTBOOK_INDEX_PARENT = process.env.TEXTBOOK_INDEX_PARENT ?? "397097c5-7668-8187-8165-f7c1e1131929";

export const TZ = process.env.APP_TZ ?? "Asia/Tokyo";

// 操作手冊 W2：每天最多 20 題
export const QUIZ_DAILY_LIMIT = 20;
// N3 night quiz：今日批次抽 10 題＋到期字最多 10 題
export const N3_BATCH_SAMPLE = 10;
export const N3_DUE_LIMIT = 10;

// N3 自補起算日（第 0 天）
export const N3_START = "2026-10-08";

/** JLPT 倒數（今日頁右邊那格） */
export const JLPT = { date: "2026-12-06", name: "JLPT N3" };

// 10 月期考試與重要日期（日本語計畫頁）
export const EXAMS: { date: string; name: string; scope: string }[] = [
  { date: "2026-10-13", name: "動詞の形テスト", scope: "可能動詞" },
  { date: "2026-10-21", name: "漢字テスト", scope: "HSJⅠ 8・9章" },
  { date: "2026-10-27", name: "動詞の形テスト", scope: "意向形" },
  { date: "2026-11-04", name: "アチーブテスト", scope: "1〜3課 語彙・文法" },
  { date: "2026-11-05", name: "漢字テスト", scope: "HSJⅡ 1・2章" },
  { date: "2026-11-06", name: "作文", scope: "「私の失敗」（5課）" },
  { date: "2026-11-11", name: "アチーブテスト", scope: "1〜5課 読解・聴解" },
  { date: "2026-11-16", name: "動詞の形テスト", scope: "尊敬動詞" },
  { date: "2026-11-17", name: "アチーブテスト／作文", scope: "4〜6課 語彙・文法／「私の国と違うこと」（7課）" },
  { date: "2026-11-19", name: "漢字テスト", scope: "HSJⅡ 3・4章" },
  { date: "2026-11-20", name: "作文", scope: "「うれしかったこと」（8課）" },
  { date: "2026-11-26", name: "動詞の形テスト", scope: "条件形" },
  { date: "2026-12-02", name: "動詞の形テスト／ビジネス日本語アチーブ", scope: "受身形／ビジネス 2・7課" },
  { date: "2026-12-03", name: "アチーブテスト／作文", scope: "7〜9課 語彙・文法／「おすすめのお土産」（10課）" },
  { date: "2026-12-07", name: "漢字テスト", scope: "HSJⅡ 5・6章" },
  { date: "2026-12-08", name: "アチーブテスト", scope: "6〜10課 読解" },
  { date: "2026-12-09", name: "動詞の形テスト／ビジネス日本語アチーブ", scope: "命令形・禁止形／ビジネス 9課" },
  { date: "2026-12-10", name: "アチーブテスト", scope: "6〜10課 聴解" },
  { date: "2026-12-11", name: "期末試験", scope: "ビジネス日本語（ロールプレイ・記述）" },
  { date: "2026-12-15", name: "アチーブテスト", scope: "10〜12課 語彙・文法" },
  { date: "2026-12-16", name: "期末試験", scope: "作文・聴解" },
  { date: "2026-12-17", name: "期末試験", scope: "語彙・文法・読解" },
  { date: "2026-12-18", name: "期末試験／漢字テスト", scope: "口頭表現／HSJⅡ 7・8章" },
];

// N3 文型順序（操作手冊「N3 自補」）：第 k 個平日學第 k 個
export const GRAMMAR_ORDER = [
  "〜うちに", "〜かのように", "〜からこそ", "〜からといって", "〜がち", "〜きる", "〜ぎみ",
  "〜ことはない", "〜こともある", "〜しかない", "〜ず（に）", "〜たて", "〜たとたん", "〜たばかり",
  "〜っぽい", "〜ていく／てくる", "〜て初めて", "〜ということだ", "〜につき", "〜に慣れる",
  "〜ふりをする", "〜ようとする", "〜わけにはいかない", "〜を始め", "〜出す", "〜向け", "〜最中に",
  "〜次第", "〜的", "〜わけだ系", "〜はず", "〜べき", "〜ものだ", "〜に違いない", "〜恐れがある",
  "〜おかげで／せいで", "〜において", "〜に対して／関して／ついて", "〜として／とともに", "〜によって系",
  "〜ば〜ほど系", "〜たびに系", "〜まま系", "〜さえ／こそ／すら", "〜ながら（逆接）／つつ", "〜どころか",
  "〜かわりに／反面", "〜以上は系", "尊敬語", "謙讓語", "お〜になる／お〜する", "使役受身",
];

export const NHK_EASY_URL = "https://www3.nhk.or.jp/news/easy/";

// 漢字庫「章」的選項（HSJⅠ 0–9章、HSJⅡ 1–8章）
export const KANJI_CHAPTERS = [
  ...Array.from({ length: 10 }, (_, i) => `HSJⅠ ${i}章`),
  ...Array.from({ length: 8 }, (_, i) => `HSJⅡ ${i + 1}章`),
];
