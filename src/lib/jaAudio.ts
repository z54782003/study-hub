// 日文發音音檔（VOICEVOX 預先產生）：讀音比對的純邏輯，產生腳本（scripts/gen-audio.ts）和測試共用。
// 不碰網路、不碰檔案；引擎回傳的資料由腳本傳進來。
import { fixPrefixReading, readingKana } from "./speech";

/** 比對規則的版本：改了 planWord／planSentence 的判斷就加一，所有音檔會重產 */
export const JA_AUDIO_RULES = 1;

// ── 假名 ─────────────────────────────────────────────

export const toKata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
export const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const SMALL = "ァィゥェォャュョヮ";
/** 片假名切成拍（小寫的ャュョ等併到前一拍；ッ、ン、ー 各自一拍） */
export function splitMoras(kata: string): string[] {
  const out: string[] = [];
  for (const c of kata) {
    if (SMALL.includes(c) && out.length) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}

const VOWEL_ROWS: Record<string, string> = {
  ア: "アカガサザタダナハバパマヤラワャヮ",
  イ: "イキギシジチヂニヒビピミリィ",
  ウ: "ウクグスズツヅヌフブプムユルュゥヴ",
  エ: "エケゲセゼテデネヘベペメレェ",
  オ: "オコゴソゾトドノホボポモヨロヲョォ",
};
/** 一拍的母音（ン、ッ、ー 沒有） */
export function vowelOf(mora: string): string | null {
  const last = mora[mora.length - 1];
  for (const [v, row] of Object.entries(VOWEL_ROWS)) if (row.includes(last)) return v;
  return null;
}

/**
 * 比對用的拍：長音一律寫成母音（トー→トオ、トウ→トオ、セイ→セエ），ヲ→オ、ヂ→ジ、ヅ→ズ。
 * 引擎的讀音是發音（センセー），我們的是假名（せんせい），兩邊都這樣轉才比得起來。
 */
export function canonMoras(moras: string[]): string[] {
  const out: string[] = [];
  for (const raw of moras) {
    let m = raw.replace(/ヲ/g, "オ").replace(/ヂ/g, "ジ").replace(/ヅ/g, "ズ");
    const prev = out.length ? vowelOf(out[out.length - 1]) : null;
    if (m === "ー" && prev) m = prev;
    else if (m === "ウ" && prev === "オ") m = "オ";
    else if (m === "イ" && prev === "エ") m = "エ";
    out.push(m);
  }
  return out;
}

/** 助詞：寫は／へ、唸ワ／エ */
export const moraEq = (a: string, b: string) => a === b || (a === "ハ" && b === "ワ") || (a === "ワ" && b === "ハ") || (a === "ヘ" && b === "エ") || (a === "エ" && b === "ヘ");

export const kanaMoras = (kana: string) => canonMoras(splitMoras(toKata(kana.replace(/[\s・.]/g, ""))));

// ── 固定讀音表（原本 speech.ts 的 SPECIAL、WORD_KANA、SAY_AS）──────────────
// null＝有兩種讀法（明日 あした／あす、一日 ついたち／いちにち…）：只照例句的標記，沒標就需抽查。
// KEEP_ONE 不轉：那是瀏覽器發音的權宜做法（避免「と聞いて」唸成「ときいて」），不是讀音規則。
export const FIXED_READINGS: Record<string, string | null> = {
  今日: "きょう", 明日: null, 昨日: "きのう", 今朝: "けさ", 今年: "ことし", 今夜: "こんや", 一日: null, 二日: "ふつか",
  一人: "ひとり", 二人: "ふたり", 大人: "おとな", 上手: "じょうず", 下手: "へた", 部屋: "へや", 眼鏡: "めがね", 土産: "みやげ",
  果物: "くだもの", 景色: "けしき", 一昨日: "おととい", 明後日: "あさって", 二十日: "はつか", 二十歳: "はたち", 八百屋: "やおや",
  紅葉: null, 博士: null, 何人: "なんにん", 何日: "なんにち", 見学会: "けんがくかい", 丈夫: "じょうぶ", 飲み放題: "のみほうだい",
  一万円札: "いちまんえんさつ", 五千円札: "ごせんえんさつ", 千円札: "せんえんさつ", 時速: "じそく",
  // WORD_KANA
  学生証: "がくせいしょう", 自分: "じぶん",
};
/** 只寫假名時重音不穩的詞：送標準漢字寫法給引擎（SAY_AS） */
export const SAY_AS_JA: Record<string, string> = { おかわり: "お代わり" };
/** 原本靠 KEEP_ONE 照原字唸的單一漢字：報告另外列出來給使用者確認 */
export const KEEP_ONE_KANJI = "聞見書読話飲買待言思動棚";

const sayAs = (s: string) => Object.entries(SAY_AS_JA).reduce((t, [k, v]) => t.split(k).join(v), s);

// ── 引擎的回傳（只取需要的）────────────────────────────

export type EngineMora = { text: string };
export type EnginePhrase = { moras: EngineMora[]; accent: number; pause_mora?: EngineMora | null };

const engineMoras = (phrases: EnginePhrase[]) => canonMoras(phrases.flatMap((p) => p.moras.map((m) => m.text)));
export const engineReading = (phrases: EnginePhrase[]) => phrases.map((p) => p.moras.map((m) => m.text).join("")).join("／");
/** 重音寫成 AquesTalk 風：核的那一拍後面加 '（VOICEVOX 的平板＝核在最後一拍） */
export const notation = (moras: string[], accent: number) => moras.map((m, i) => m + (i === accent - 1 ? "'" : "")).join("");

// ── 單字的音高塑形 ───────────────────────────────────
// VOICEVOX 的重音起伏很弱：平板詞詞尾會往下滑（できあがり⓪ 的「り」掉約 3 個半音），雨① 單獨唸幾乎不降。
// 有填聲調的單字，合成前照東京式重音把每一拍拉成清楚的高／低。改了規則就把 PITCH_SHAPE 加一（只有有聲調的單字會重產）。
export const PITCH_SHAPE = 1;
/** 第一拍是低拍時比高拍低多少（log F0；0.2 ≈ 3.5 個半音） */
export const PITCH_RISE = 0.2;
/** 核之後的拍比高拍低多少（0.3 ≈ 5 個半音） */
export const PITCH_FALL = 0.3;

/**
 * 東京式重音：每一拍高（true）或低（false）。pitch＝Notion 的聲調：0＝平板，n＝第 n 拍是核（之後下降）。
 * 第一拍：①高，其他低；第二拍以後：平板或還沒過核是高、過了核是低。pitch 超過拍數當成尾高（單獨唸和平板一樣）。
 */
export function highMoras(count: number, pitch: number): boolean[] {
  const core = pitch === 0 || pitch > count ? count : pitch;
  return Array.from({ length: count }, (_, i) => (i === 0 ? core === 1 : i < core));
}

/**
 * 把引擎給的每拍音高改成照聲調的高低：高拍＝引擎有聲拍裡最高的音，第一拍的低＝高－PITCH_RISE，核之後的低＝高－PITCH_FALL。
 * 無聲的拍（音高 0：促音、無聲化母音）不動。
 */
export function shapePitch(pitches: number[], pitch: number): number[] {
  const voiced = pitches.filter((p) => p > 0);
  if (!voiced.length) return pitches;
  const high = Math.max(...voiced);
  const hl = highMoras(pitches.length, pitch);
  return pitches.map((p, i) => (p <= 0 ? p : hl[i] ? high : high - (i === 0 ? PITCH_RISE : PITCH_FALL)));
}

/** 報告用：每拍「高／低」，無聲的拍標「無」 */
export const contourText = (pitches: number[], pitch: number) =>
  highMoras(pitches.length, pitch)
    .map((h, i) => (pitches[i] <= 0 ? "無" : h ? "高" : "低"))
    .join("");

// ── 單字 ─────────────────────────────────────────────

export const WORD_VERDICT = {
  ok: "一致",
  override: "已用我的資料覆蓋",
  noPitch: "聲調沒填需抽查",
  multi: "需抽查（多讀音，用第一個）",
  table: "需抽查（和讀音表不同）",
  skip: "跳過（〜）",
} as const;

/** 送引擎的單字：拿掉（漢字）（な）這類註記和「・」；帶「〜」的不產（App 退回瀏覽器發音） */
export function wordInput(word: string): string | null {
  if (/[〜～~]/.test(word)) return null;
  const t = word.replace(/[（(［\[][^）)］\]]*[）)］\]]/g, "").replace(/[・\s]/g, "");
  return t ? sayAs(t) : null;
}

/** 「音標/假名」有幾個讀音（なん／なに、つち／ど、ひ（訓讀み）・か（曜日））；只看形式，不算括號 */
export function readingCount(reading: string): number {
  return reading.replace(/[（(［\[][^）)］\]]*[）)］\]]/g, "").split(/[／/・、,]/).filter((s) => s.replace(/[.\-\s]/g, "")).length;
}

export type WordPlan = {
  verdict: (typeof WORD_VERDICT)[keyof typeof WORD_VERDICT];
  /** 我的讀音（假名） */
  kana: string;
  engineKana: string;
  engineAccent: number | null;
  /** 我的資料要的重音（VOICEVOX：平板＝拍數）；null＝聲調沒填 */
  accent: number | null;
  /** true＝不用引擎的結果，改用我的假名（＋聲調）合成 */
  override: boolean;
  note: string;
};

/**
 * 比對引擎對「單字」的讀音、重音和 Notion 的「音標/假名」「聲調」。
 * 聲調：0＝平板（VOICEVOX 寫成拍數），n＝第 n 拍是核。
 */
export function planWord(src: { word: string; reading: string; pitch: number | null }, engine: EnginePhrase[]): WordPlan {
  const kana = readingKana(src.reading, src.word);
  const mine = kanaMoras(kana);
  const theirs = engineMoras(engine);
  const readingOk = mine.length === theirs.length && mine.every((m, i) => moraEq(m, theirs[i]));
  const accent = src.pitch === null ? null : src.pitch === 0 ? mine.length : src.pitch;
  const engineAccent = engine.length === 1 ? engine[0].accent : null;
  const pitchOk = accent === null || (engineAccent !== null && engineAccent === accent);
  const notes: string[] = [];
  if (!readingOk) notes.push(`引擎唸 ${engineReading(engine)}`);
  if (accent !== null && !pitchOk) notes.push(engine.length > 1 ? `引擎切成 ${engine.length} 個重音句` : `引擎重音 ${engineAccent}`);
  const fixed = FIXED_READINGS[wordInput(src.word) ?? ""];
  const tableOff = fixed !== undefined && fixed !== null && kanaMoras(fixed).join("") !== mine.join("");
  if (tableOff) notes.push(`讀音表是 ${fixed}`);
  const override = !readingOk || !pitchOk;
  const verdict =
    readingCount(src.reading) > 1
      ? WORD_VERDICT.multi
      : tableOff
        ? WORD_VERDICT.table
        : accent === null
          ? WORD_VERDICT.noPitch
          : override
            ? WORD_VERDICT.override
            : WORD_VERDICT.ok;
  return { verdict, kana, engineKana: engineReading(engine), engineAccent, accent, override, note: notes.join("；") };
}

// ── 例句 ─────────────────────────────────────────────

export type Seg =
  | { kind: "kana"; text: string }
  | { kind: "ruby"; base: string; reading: string; from: "標記" | "讀音表" }
  | { kind: "other"; text: string; unknownKanji: boolean }
  | { kind: "punct"; text: string };

const KANJI = "\\u4e00-\\u9fff々〆ヶ";
const KANA = "\\u3040-\\u309f\\u30a0-\\u30ffー";
const RUBY = new RegExp(`([${KANJI}]+)[（(]([${KANA}・\\s]+)[）)]`, "y");

/**
 * 例句拆段：「漢字（かな）」→ ruby；假名；沒標讀音的漢字／數字／英文 → other（比對時當萬用字元）；標點。
 * 先套用 fixPrefixReading（ご飯（ごはん）），拿掉不是接在漢字後面的括號（「（ノックして）」這種舞台指示）。
 * 沒標讀音的漢字如果在讀音表裡（今日），用表上的讀音。
 */
export function parseSentence(raw: string): Seg[] {
  const text = fixPrefixReading(raw).replace(new RegExp(`(^|[^${KANJI}])[（(][^）)]*[）)]`, "g"), "$1");
  const segs: Seg[] = [];
  let i = 0;
  const push = (s: Seg) => {
    const last = segs[segs.length - 1];
    if (last && last.kind === s.kind && s.kind !== "ruby" && last.kind !== "ruby") {
      (last as { text: string }).text += (s as { text: string }).text;
      if (s.kind === "other" && last.kind === "other") last.unknownKanji ||= s.unknownKanji;
    } else segs.push(s);
  };
  while (i < text.length) {
    RUBY.lastIndex = i;
    const m = RUBY.exec(text);
    if (m) {
      segs.push({ kind: "ruby", base: m[1], reading: m[2].replace(/[・\s]/g, ""), from: "標記" });
      i = RUBY.lastIndex;
      continue;
    }
    const c = text[i];
    if (new RegExp(`[${KANJI}]`).test(c)) {
      // 一串沒標讀音的漢字：讀音表裡有（最長的）就用表上的讀音
      const run = text.slice(i).match(new RegExp(`^[${KANJI}]+`))![0];
      const hit = Object.keys(FIXED_READINGS)
        .filter((w) => run.startsWith(w) && FIXED_READINGS[w])
        .sort((a, b) => b.length - a.length)[0];
      if (hit) {
        segs.push({ kind: "ruby", base: hit, reading: FIXED_READINGS[hit]!, from: "讀音表" });
        i += hit.length;
      } else {
        push({ kind: "other", text: c, unknownKanji: true });
        i++;
      }
    } else if (new RegExp(`[${KANA}]`).test(c)) {
      push({ kind: "kana", text: c });
      i++;
    } else if (/[\s、。，,．.！!？?「」『』（）()／/…・：:〜～]/.test(c)) {
      push({ kind: "punct", text: c });
      i++;
    } else {
      push({ kind: "other", text: c, unknownKanji: false });
      i++;
    }
  }
  return segs;
}

/** 送引擎的文字；override 裡的 ruby（段落編號）改送標註的讀音（片假名） */
export function sentenceInput(segs: Seg[], override: Set<number> = new Set()): string {
  return sayAs(
    segs
      .map((s, i) => {
        if (s.kind === "ruby") return override.has(i) ? toKata(s.reading) : s.base;
        return s.kind === "punct" ? (s.text === "／" || s.text === "/" ? "。" : s.text) : s.text;
      })
      .join(""),
  );
}

type Tok = { seg: number; mora: string | null }; // mora null＝萬用字元

/**
 * 我的讀音和引擎的讀音逐拍對齊（動態規劃，萬用字元可以吃掉一拍以上），
 * 回傳對不上的段落編號。插進來的拍算在後一段。
 */
export function misalignedSegments(segs: Seg[], engine: EnginePhrase[]): Set<number> {
  const exp: Tok[] = [];
  const raw: { seg: number; moras: string[] | null }[] = [];
  segs.forEach((s, i) => {
    if (s.kind === "kana") raw.push({ seg: i, moras: splitMoras(toKata(s.text)) });
    else if (s.kind === "ruby") raw.push({ seg: i, moras: splitMoras(toKata(s.reading)) });
    else if (s.kind === "other") raw.push({ seg: i, moras: null });
  });
  // 長音要跨段落一起轉（先生（せんせい）い → 不會；但「ちょう」跨段時要看前一拍）
  const flat = canonMoras(raw.flatMap((r) => r.moras ?? ["＊"]));
  let k = 0;
  for (const r of raw) {
    if (r.moras === null) {
      exp.push({ seg: r.seg, mora: null });
      k++;
    } else for (let j = 0; j < r.moras.length; j++) exp.push({ seg: r.seg, mora: flat[k++] });
  }
  const got = engineMoras(engine);
  const n = exp.length;
  const m = got.length;
  const INF = 1e9;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
  const how = Array.from({ length: n + 1 }, () => new Array<string>(m + 1).fill(""));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const cur = dp[i][j];
      if (cur >= INF) continue;
      const relax = (a: number, b: number, c: number, h: string) => {
        if (c < dp[a][b]) {
          dp[a][b] = c;
          how[a][b] = h;
        }
      };
      if (i < n && j < m) {
        const e = exp[i];
        if (e.mora === null) relax(i + 1, j + 1, cur, "w"); // 萬用字元吃一拍
        else relax(i + 1, j + 1, cur + (moraEq(e.mora, got[j]) ? 0 : 1), moraEq(e.mora, got[j]) ? "m" : "s");
      }
      if (i > 0 && j < m && exp[i - 1].mora === null && (how[i][j] === "w" || how[i][j] === "W")) relax(i, j + 1, cur, "W"); // 萬用字元繼續吃
      if (i < n) relax(i + 1, j, cur + 1, "d");
      if (j < m) relax(i, j + 1, cur + 1, "i");
    }
  const bad = new Set<number>();
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const h = how[i][j];
    if (h === "m" || h === "w") (i--, j--);
    else if (h === "W") j--;
    else if (h === "s") (bad.add(exp[i - 1].seg), i--, j--);
    else if (h === "d") (bad.add(exp[i - 1].seg), i--);
    else if (h === "i") (bad.add(exp[Math.min(i, n - 1)]?.seg ?? -1), j--);
    else break;
  }
  bad.delete(-1);
  return bad;
}

export const SENTENCE_VERDICT = {
  ok: "一致",
  override: "已用我的資料覆蓋",
  check: "需抽查",
} as const;

export type SentencePlan = {
  verdict: (typeof SENTENCE_VERDICT)[keyof typeof SENTENCE_VERDICT];
  /** 送引擎的文字（第一次） */
  input: string;
  /** 要改送讀音的段落；空的＝不用改 */
  override: Set<number>;
  note: string;
};

/** 第一次比對：哪些標了讀音的詞要改送讀音 */
export function planSentence(segs: Seg[], engine: EnginePhrase[]): SentencePlan {
  const bad = misalignedSegments(segs, engine);
  const override = new Set([...bad].filter((i) => segs[i].kind === "ruby"));
  return { verdict: override.size ? SENTENCE_VERDICT.override : SENTENCE_VERDICT.ok, input: sentenceInput(segs), override, note: "" };
}

/** 改送讀音後再比一次，加上沒辦法確認的地方（沒標讀音的漢字、假名本身對不上），決定最後的判定 */
export function finishSentence(segs: Seg[], plan: SentencePlan, engineAfter: EnginePhrase[]): SentencePlan {
  const still = misalignedSegments(segs, engineAfter);
  const notes: string[] = [];
  const word = (i: number) => {
    const s = segs[i];
    return s.kind === "ruby" ? `${s.base}（${s.reading}）` : s.kind === "punct" ? "" : s.text;
  };
  if (plan.override.size) notes.push(`改送讀音：${[...plan.override].map(word).join("、")}`);
  if (still.size) notes.push(`還是對不上：${[...still].map(word).filter(Boolean).join("、")}`);
  const unknown = segs.filter((s): s is Extract<Seg, { kind: "other" }> => s.kind === "other" && s.unknownKanji).map((s) => s.text);
  if (unknown.length) notes.push(`沒標讀音的漢字：${unknown.join("、")}`);
  const table = segs.filter((s) => s.kind === "ruby" && s.from === "讀音表").map((s) => (s as { base: string }).base);
  if (table.length) notes.push(`用讀音表：${table.join("、")}`);
  const verdict = still.size || unknown.length ? SENTENCE_VERDICT.check : plan.override.size ? SENTENCE_VERDICT.override : SENTENCE_VERDICT.ok;
  return { ...plan, verdict, note: notes.join("；") };
}

/** 句子裡原本靠 KEEP_ONE 照原字唸的地方（聞（き）いて、棚（たな）），報告另外列 */
export function keepOneHits(segs: Seg[]): string[] {
  return segs.flatMap((s, i) => {
    if (s.kind !== "ruby" || s.base.length !== 1 || !KEEP_ONE_KANJI.includes(s.base)) return [];
    const before = segs[i - 1];
    const after = segs[i + 1];
    const t = (x?: Seg) => (!x ? "" : x.kind === "ruby" ? x.base : x.text);
    return [`${t(before).slice(-2)}${s.base}（${s.reading}）${t(after).slice(0, 3)}`];
  });
}
