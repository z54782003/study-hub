// 本機預覽用的假資料（MOCK=1 且沒有 NOTION_TOKEN 時才會用到）。
import { EXAMS } from "./config";
import { addDays, diffDays, formatJP, isWeekend } from "./dates";
import type { N3Detail } from "./n3Detail";
import type { ReviewItem, TodayData, VocabItem } from "./types";
import type { TedTalk } from "./ted";

export function mockToday(day: string): TodayData {
  return {
    date: day,
    dateLabel: formatJP(day),
    weekend: isWeekend(day),
    exams: EXAMS.map((e) => ({ ...e, daysLeft: diffDays(day, e.date) })).filter((e) => e.daysLeft >= 0 && e.daysLeft <= 7),
    homework: [{ text: "文法ノート 練習8–10（p.19–22）", due: "2026-10-28", url: "#", daysLeft: 1 }],
    // MOCK_EMPTY_CAL=1 看「今天沒有行程→顯示下一個」的樣子
    calendar: process.env.MOCK_EMPTY_CAL
      ? []
      : [
          { title: "ISI 上課", allDay: false, start: "13:00", end: "16:10", location: "ISI 307", sortKey: 2 },
          { title: "牙醫", allDay: false, start: "09:30", end: "10:30", location: "新宿", sortKey: 1 },
        ].sort((a, b) => a.sortKey - b.sortKey),
    nextCalendar: process.env.MOCK_EMPTY_CAL
      ? {
          date: addDays(day, 3),
          events: [
            { title: "校外学習（大工体験）", allDay: false, start: "12:30", end: "16:00", location: "練馬", sortKey: 1 },
            { title: "ハロウィン", allDay: true, start: null, end: null, location: null, sortKey: 0 },
          ],
        }
      : null,
    // 2026-10-27 預習頁實際解析結果（複習日：文法是表格＋易混淆整理）
    preview: {
      title: "10/27（火）預習｜L3",
      url: "#",
      lesson: "できる日本語 初中級 第3課「私の目標」——今天是 L3 最終日（星合先生）。ST3-1「これからの計画」、ST3-2「夢に向かって」的文法與ことば已全部教完。",
      exam: "動詞の形テスト（意向形）——グループ1・2・3的意向形變化規則（10/26課堂最後老師已口頭複習過）。",
      grammarTitle: "L3 全課文法快速複習（今天沒有新文法，考試前掃一遍）",
      grammar: [
        "① 〜たら、〜\t如果・…的話就",
        "② 〜（よ）うと思っています\t打算、正考慮",
        "③ 〜つもりです／〜ないつもりです\t打算／不打算",
        "④ 疑問詞＋普通形か、〜\t（還在想）要…呢",
        "⑤ 普通形かどうか、〜\t是否…（還不確定）",
        "⑥ Nの・V辞書形ために、〜\t為了…（目的）",
        "⑦ 普通形んです／んですが\t說明理由／確認情況",
        "⑧ Vナイ形—なければなりません\t不得不、必須",
      ],
      grammarNote:
        "易混淆總整理：②③都是「打算做」，但②較婉轉像是正在思考、③是已經決定；⑥的「〜ために」是自己設定的目的，跟⑧「なければなりません」的「不得不做」語感不同——⑥是主動追求的目標，⑧是被迫的義務。",
    },
    n3: { count: 38, grammar: [{ name: "〜たばかり", url: "#" }] },
    // MOCK_CLASS=preview 看課前（只有預習頁）的樣子
    classNote:
      process.env.MOCK_CLASS === "preview"
        ? null
        : {
            title:
              "10/26（月）できる L3｜ST2 夢に向かって・〜ために・〜んです／〜んですが・疑問詞＋んですか・〜なければなりません・漢字（体・色・黄・赤）／本冊p.48–51",
            url: "#",
            status: "已整理",
            summary:
              "①連絡:11/13(金)12:30〜練馬で校外学習(大工体験)・授業なし・欠席扱いにならない ②漢字:体・色(色の語彙・顔色/調子のコロケーション)・黄・赤 ③宿題確認 文法ノート1〜7(たら/思っています/つもり/疑問詞か/かどうか) ④p.47聞いて書く(マルコさん) ⑤ST2 夢に向かって:ことば16語・パクさん会話 ⑥文法4つ:〜ために／〜んです・んですが(確認と理由)／疑問詞＋んですか／〜なければなりません ⑦別冊p.12–13・言ってみようp.50–51ペア ⑧p.51聞いてみよう(ワンさん・ブロイさん) ⑨宿題:文法ノート8〜13 ⑩テスト予告:10/27(火)意向形テスト(推定・録音で明言なし→❓)",
            homework:
              "①文法ノート 大8〜13番（〜ために／〜んですか／疑問詞＋んですか／どうして〜んですか—〜んです／〜んです選択／〜なければなりません）＝今日の宿題（先生：授業中に8番から着手→残りは家で）。②（先生の注意）宿題はなるべくやってきた方がいい。※提出日・期限の指示は録音に無し。",
          },
    review: { quiz: 20, n3: 20, grammar: 2 },
    ted: { title: "How to make stress your friend", url: "/ted/mock", progress: "今天做" },
    books: [
      { title: "コンビニ人間", url: "#", type: "Graded reader" },
      { title: "Atomic Habits", url: "#", type: "Book" },
    ],
    errors: [],
  };
}

export function mockReview(): ReviewItem[] {
  return [
    {
      kind: "quiz",
      id: "q1",
      prompt: "C2：請翻譯成日文：「背新單字很辛苦。」",
      qtype: "C 翻譯",
      answer: "新しい単語を覚えるのは大変です。",
      explanation: "「〜のは大変です」：把動作名詞化後評價。覚える（おぼえる）＝記住。",
      lastResult: "❌ 錯",
      myAnswer: "新しい単語を覚えるのが大変です。",
      lastTested: "2026-10-26",
    },
    {
      kind: "quiz",
      id: "q2",
      prompt: "B：雨が（　）そうです。（看起來快下雨了）",
      qtype: "B 文法填空",
      answer: "降り",
      explanation: "動詞ます形去ます＋そうです＝看起來快要…",
      lastResult: "— 未作答",
      myAnswer: "",
      lastTested: null,
    },
    {
      kind: "quiz",
      id: "q3",
      prompt: "顔色が（　）ですね。大丈夫ですか。 ①いい ②悪い ③高い（心配するとき）",
      qtype: "A 單字選擇",
      answer: "② 悪い（顔色が悪い＝臉色不好）",
      explanation: "顔色（かおいろ）與「悪い／いい」搭配，表示氣色。",
      lastResult: "❌ 錯",
      myAnswer: "① いい",
      lastTested: "2026-10-25",
    },
    {
      kind: "n3",
      id: "n1",
      word: "経験",
      reading: "けいけん",
      meaning: "經驗",
      pos: "名詞・する動詞",
      note: "",
      level: "N3",
      status: "學習中",
      source: "due",
    },
    {
      kind: "n3",
      id: "n2",
      word: "締め切り",
      reading: "しめきり",
      meaning: "截止日期",
      pos: "名詞",
      note: "レポートの締め切りは明日だ。",
      level: "N3",
      status: "未學",
      source: "batch",
    },
    {
      kind: "grammar",
      id: "g1",
      pattern: "〜たばかり",
      meaning: "剛…完（主觀上覺得時間很短）",
      connection: "動詞た形＋ばかり",
      confusable: "〜たところ（客觀上剛結束）",
      status: "未學",
    },
  ];
}

export function mockVocab(): VocabItem[] {
  return [
    {
      kind: "vocab",
      id: "v1",
      word: "目標",
      reading: "もくひょう",
      meaning: "目標",
      pos: "n. 名詞",
      usage: "目標を立てる／目標に向かって／目標を達成する",
      examples: [
        { ja: "今年の目標を立てました。", zh: "我訂了今年的目標。" },
        { ja: "目標に向かって毎日勉強しています。", zh: "朝著目標每天唸書。" },
      ],
      lesson: "初中級 L3",
      lang: "ja",
      status: "學習中",
      right: 2,
      wrong: 1,
    },
    {
      kind: "vocab",
      id: "v2",
      word: "諦める",
      reading: "あきらめる",
      meaning: "放棄",
      pos: "v. 動詞",
      usage: "夢を諦める／諦めないで",
      examples: [{ ja: "最後まで諦めないでください。", zh: "請堅持到最後。" }],
      lesson: "初中級 L3",
      lang: "ja",
      status: "未學",
      right: 2,
      wrong: 1,
    },
  ];
}

export function mockHistory(day: string) {
  const out = [];
  for (let d = 0; d < 40; d++) {
    const n = (d * 7) % 5 === 0 ? 0 : ((d * 13) % 9) + 2;
    for (let i = 0; i < n; i++)
      out.push({
        id: `${d}-${i}`,
        day: addDays(day, -d),
        title: i % 3 ? "新しい単語を覚えるのは大変です。" : "経験",
        kind: i % 3 ? "題庫" : "N3 單字",
        correct: (d + i) % 4 !== 0,
        answer: (d + i) % 4 ? "" : "新しい単語を覚えるのが大変です。",
        reference: "新しい単語を覚えるのは大変です。",
        url: "#",
      });
  }
  return out;
}

export async function mockAnswer(): Promise<void> {}
export async function mockJournal(): Promise<void> {}

// 播放器預覽：用一段公開的測試影片＋假字幕
export function mockTedTalk(): TedTalk {
  const lines: [string, string][] = [
    ["I have a confession to make, but first,", "我要先坦白一件事，但首先，"],
    ["I want you to make a little confession to me.", "我希望你們先對我坦白一件小事。"],
    ["In the past year, I want you to just raise your hand", "在過去一年裡，請舉手"],
    ["if you've experienced relatively little stress.", "如果你經歷的壓力相對較少。"],
    ["Anyone?", "有人嗎？"],
    ["How about a moderate amount of stress?", "那中等程度的壓力呢？"],
    ["Who has experienced a lot of stress?", "誰經歷過很大的壓力？"],
    ["Yeah. Me too.", "對，我也是。"],
  ];
  return {
    title: "How to make stress your friend",
    speaker: "Kelly McGonigal",
    video: process.env.MOCK_HLS_URL
      ? { type: "hls", url: process.env.MOCK_HLS_URL, fallback: process.env.MOCK_VIDEO_URL ?? "/mock.mp4" }
      : { type: "mp4", url: process.env.MOCK_VIDEO_URL ?? "/mock.mp4", fallback: null },
    youtube: null,
    cues: lines.map(([text, zh], i) => ({ start: i * 1.25, end: (i + 1) * 1.25, text, zh })),
    languages: ["en", "zh-tw"],
    chinese: "zh-tw",
    subtitleTimestampMap: null,
  };
}

export function mockN3Detail(id: string): N3Detail {
  return id === "g1"
    ? {
        usage: "動作剛完成不久，說話者覺得「才剛…」。時間長短是主觀感覺，過了一個月也可以用。",
        forms: ["動詞た形＋ばかり", "動詞た形＋ばかりの＋名詞"],
        collocations: [],
        examples: [
          { ja: "日本に来たばかりなので、まだ友達がいません。", kana: "にほんにきたばかりなので、まだともだちがいません。", zh: "因為才剛來日本，還沒有朋友。" },
          { ja: "買ったばかりの傘をなくしてしまった。", kana: "かったばかりのかさをなくしてしまった。", zh: "把剛買的傘弄丟了。" },
        ],
        compare: "〜たところ：客觀上動作剛結束的那一刻；〜たばかり：主觀覺得沒過多久。",
      }
    : {
        usage: "做事的期限、截止的時間點。常用在報告、申請、報名。",
        forms: [],
        collocations: [
          { ja: "締め切りに間に合う", zh: "趕上截止" },
          { ja: "締め切りを延ばす", zh: "延後截止日" },
        ],
        examples: [
          { ja: "レポートの締め切りは明日です。", kana: "れぽーとのしめきりはあしたです。", zh: "報告明天截止。" },
          { ja: "締め切りに間に合わなかった。", kana: "しめきりにまにあわなかった。", zh: "沒趕上截止。" },
        ],
        compare: "期限：有效期間的界線（賞味期限）；締め切り：交件、報名的截止。",
      };
}
