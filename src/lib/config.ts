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
  goals: process.env.DS_GOALS ?? "52f097c5-7668-82f0-9186-07bf435b1b7a", // 🏔 Goals（Life Planner：年→季→月）
  tasks: process.env.DS_TASKS ?? "66220cad-19e4-4eae-9019-7c3708e8c599", // 📅 Tasks（Life Planner 的待辦）
  eviu: process.env.DS_EVIU ?? "26eff28f-4786-4617-bc65-7989cd6f5950", // 📚 EVIU Units（English Vocabulary in Use）
  speaking: process.env.DS_SPEAKING ?? "424097c5-7668-811b-9fd9-000b2d316a0b", // 口說練習（言ってみよう）：「できる日本語 初中級」課程頁底下
};

// 「每日預習（W3）」父頁，底下一天一頁，標題「MM/DD（曜）預習｜L〇 ST〇」
export const W3_PARENT_PAGE = process.env.W3_PARENT_PAGE ?? "3f2097c576688100bc56d2f56e4d80c7";

// 📼 課文音檔（できる日本語 初中級）：光碟版 mp3（7012019_DiscA_NN…）；頁面在「できる日本語 初中級」課程頁底下
export const LESSON_AUDIO_PAGE = process.env.LESSON_AUDIO_PAGE ?? "406097c5-7668-810e-ade7-e0954334c539";

// 課本索引頁（一課一頁）放在哪些頁：2026-11-16 起放在兩個課程頁的「課本索引｜L1–L15」toggle 裡，
// 會往 toggle／分欄裡找（src/lib/childPages.ts）。依序：
//   「できる日本語 初中級」課程頁 → 初中級課本索引｜L〇（單字分頁、課文音檔的課文）
//   「できる日本語 初級」課程頁 → 課本索引｜L〇（初級單字分頁）
//   🎯 日本語計畫頁（舊位置，留著當後備）
// 環境變數 TEXTBOOK_INDEX_PARENTS 可用逗號分隔覆寫。
export const TEXTBOOK_INDEX_PARENTS = process.env.TEXTBOOK_INDEX_PARENTS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
  "3eb097c5-7668-8179-a03e-cadeed5578bc",
  "3eb097c5-7668-817c-8e0b-ebf95a08161d",
  "397097c5-7668-8187-8165-f7c1e1131929",
];

export const TZ = process.env.APP_TZ ?? "Asia/Tokyo";

// ── 學習計畫的四個階段（日本語計畫頁 2026-11-16 改版）────────────────
// 每個階段只有一件「每天必做」，其他都是有空再做。目前階段用今天的日期決定（src/lib/stages.ts）。
export type Stage = {
  no: 1 | 2 | 3 | 4;
  name: string;
  start: string;
  end: string;
  /** 計畫頁寫的每天必做 */
  must: string;
  /** 這個階段暫停的項目（計畫頁原文） */
  paused: string[];
  /** 首頁右上倒數卡的標題（倒數到這個階段的 end） */
  countdown: string;
  /** 有上課：今日頁顯示預習、課堂筆記 */
  school: boolean;
  /** 今日頁「必做」那一組的任務 id；其餘任務放「有空再做」 */
  mustTasks: string[];
  /** 到期複習的題庫題：due＝到期題（❌／未作答優先，不夠再補 ✅）；debt＝只出 ❌ 和未作答（清積壓） */
  quiz: "due" | "debt";
  /** 新的 N3 單字（每天 25 個）：true／false，或「題庫積壓清空、或到 from 那天，先到的那天」才開始 */
  n3Words: boolean | { afterDebt: true; from: string };
  /** N3 到期單字、忘記的文型進到期複習（不論有沒有新字；有新字的日子一律會複習 N3 單字） */
  n3Review: boolean;
  /** 新的 N3 文型：from 起每個平日 1 個 */
  grammar: { from: string } | false;
};

export const STAGES: Stage[] = [
  {
    no: 1,
    name: "期末衝刺",
    start: "2026-11-17",
    end: "2026-12-18",
    must: "看當天課堂筆記＋隔天考試範圍（20 分）",
    paused: ["N3 單字與文型", "題庫清積壓", "初級單字測驗", "口說"],
    countdown: "期末",
    school: true,
    mustTasks: ["class-note", "exam"],
    quiz: "due",
    n3Words: false,
    n3Review: false,
    grammar: false,
  },
  {
    no: 2,
    name: "寒假清債",
    start: "2026-12-19",
    end: "2027-01-06",
    must: "初級單字測驗 1 課＋題庫錯題 20 題",
    paused: ["N3 文型"],
    countdown: "寒假結束",
    school: false,
    mustTasks: ["beginner-vocab", "review"],
    quiz: "debt",
    n3Words: { afterDebt: true, from: "2027-01-01" },
    // 到期複習只出題庫錯題；N3 單字開始後才加進 N3 單字（文型暫停）
    n3Review: false,
    grammar: false,
  },
  {
    no: 3,
    name: "1 月期",
    start: "2027-01-07",
    end: "2027-04-07",
    must: "N3 單字 25 個＋平日 1 個文型",
    paused: [],
    countdown: "1 月期結束",
    school: true,
    mustTasks: ["n3"],
    quiz: "due",
    n3Words: true,
    n3Review: true,
    grammar: { from: "2027-01-07" },
  },
  {
    no: 4,
    name: "4 月期",
    start: "2027-04-08",
    end: "2027-06-30",
    must: "N2 文法 1 個（單字量之後再定）",
    paused: [],
    countdown: "4 月期結束",
    school: true,
    mustTasks: ["n2-grammar"],
    quiz: "due",
    // 單字量之後再定：先不出新的 N3 單字，到期的照樣複習
    n3Words: false,
    n3Review: true,
    grammar: false,
  },
];

// 今日頁的提醒：from～to（含）這幾天顯示在考試、作業提醒那一區
export const REMINDERS: { from: string; to: string; text: string }[] = [
  // 3 月最後一週（3/25–3/31）
  { from: "2027-03-25", to: "2027-03-31", text: "做 N3 模擬卷（決定 7 月報 N2 或 N3）" },
];

// 操作手冊 W2：題庫每天最多 20 題（當天已經答過的也算進去）
export const QUIZ_DAILY_LIMIT = 20;
// N3 night quiz：今日批次全部考（考過熟悉度才會離開「未學」）＋到期字最多 10 題
export const N3_DUE_LIMIT = 10;

// N3 單字：JLPT Level 是 N3／N2+、熟悉度_K 是「未學」或空白的，依編號由小到大每天取 25 個。
// 每天第一次讀到的 25 個固定到當天結束；沒考完的隔天還是排在最前面。哪些階段出新字見 STAGES.n3Words。
export const N3_BATCH_SIZE = 25;

// ── 學期設定（ISI）：起訖、上課時間、考試表 ─────────────────────────
export type Exam = { date: string; name: string; scope: string };
export type Term = {
  name: string;
  start: string;
  end: string;
  /** 今日頁「看今天的課堂筆記」上面那條分隔線；null＝還不知道 */
  classTime: string | null;
  /** 考試與重要日期（日本語計畫頁）；拿到考試表再補 */
  exams: Exam[];
};

export const TERMS: Term[] = [
  {
    name: "10 月期（初中級）",
    start: "2026-10-07",
    end: "2026-12-18",
    classTime: "13:00–16:10",
    exams: [
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
    ],
  },
  // 1 月期、4 月期：結束日和上課時間還不知道（結束日先抓到下一期開學前一天、6 月底），考試表拿到再補
  { name: "1 月期", start: "2027-01-07", end: "2027-04-07", classTime: null, exams: [] },
  { name: "4 月期", start: "2027-04-08", end: "2027-06-30", classTime: null, exams: [] },
];

/** 所有學期的考試，照日期排 */
export const EXAMS: Exam[] = TERMS.flatMap((t) => t.exams).sort((a, b) => a.date.localeCompare(b.date));

// N3 文型順序（操作手冊「N3 自補」）：STAGES.grammar.from 起每個平日學「第一個還沒學過的」，週末複習這週學過的
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
