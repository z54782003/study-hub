// 動詞活用：從單字庫的動詞（日文活用＝五段／一段／サ変／カ変）依規則算出各種形。
// 單字庫的寫法有三種：「読む」「読みます（読む）」「読みます［読む］」，先統一成辭書形。

export type VerbClass = "五段" | "一段" | "サ変" | "カ変";
export const VERB_CLASSES: VerbClass[] = ["五段", "一段", "サ変", "カ変"];
/** 課本的叫法：G1＝五段、G2＝一段、G3＝サ変・カ変 */
export const GROUP_OF: Record<VerbClass, "G1" | "G2" | "G3"> = { 五段: "G1", 一段: "G2", サ変: "G3", カ変: "G3" };

export const FORMS = ["ます", "ない", "て", "た", "可能", "意向", "條件", "受身", "命令", "禁止", "尊敬"] as const;
export type VerbForm = (typeof FORMS)[number];

export const FORM_LABEL: Record<VerbForm, string> = {
  ます: "ます形",
  ない: "ない形",
  て: "て形",
  た: "た形",
  可能: "可能形",
  意向: "意向形",
  條件: "條件形（〜ば）",
  受身: "受身形",
  命令: "命令形",
  禁止: "禁止形",
  尊敬: "尊敬動詞",
};

export const FORM_RULE: Record<VerbForm, string> = {
  ます: "G1：う段→い段＋ます（書く→書きます）／G2：去る＋ます／G3：します・きます",
  ない: "G1：う段→あ段＋ない（う→わ：買う→買わない）／G2：去る＋ない／G3：しない・こない／ある→ない",
  て: "G1：う・つ・る→って／む・ぶ・ぬ→んで／く→いて／ぐ→いで／す→して（行く→行って）／G2：去る＋て／G3：して・きて",
  た: "て形的て→た、で→だ",
  可能: "G1：う段→え段＋る（書ける）／G2：去る＋られる／G3：できる・こられる",
  意向: "G1：う段→お段＋う（書こう）／G2：去る＋よう／G3：しよう・こよう",
  條件: "G1：う段→え段＋ば（書けば）／G2：去る＋れば／G3：すれば・くれば",
  受身: "G1：う段→あ段＋れる（う→わ：言われる）／G2：去る＋られる／G3：される・こられる",
  命令: "G1：う段→え段（書け）／G2：去る＋ろ／G3：しろ・こい",
  禁止: "辭書形＋な（書くな・食べるな・するな・くるな）",
  尊敬: "特別尊敬動詞：いらっしゃる・召し上がる・おっしゃる・ご覧になる・なさる・くださる…",
};

export type Verb = {
  id: string;
  /** 辭書形（漢字），例：読む、勉強する */
  dict: string;
  /** 辭書形讀音（平假名），例：よむ、べんきょうする */
  reading: string;
  cls: VerbClass;
  meaning: string;
};

// ── 從單字庫的寫法取出辭書形 ─────────────────────────────

const BRACKET = /[［\[（(]([^］\]）)]+)[］\]）)]\s*$/;

const I_TO_U: Record<string, string> = {
  い: "う", き: "く", ぎ: "ぐ", し: "す", ち: "つ", に: "ぬ", び: "ぶ", み: "む", り: "る",
};

/** ます形 → 辭書形（只處理結尾） */
function fromMasu(s: string, cls: VerbClass): string {
  const stem = s.replace(/ます$/, "");
  if (cls === "サ変") return stem.replace(/し$/, "") + "する";
  if (cls === "カ変") return stem.replace(/き$/, "") + (/[来來]$/.test(stem) ? "る" : "くる");
  if (cls === "一段") return stem + "る";
  const last = stem.slice(-1);
  return I_TO_U[last] ? stem.slice(0, -1) + I_TO_U[last] : stem;
}

function toDict(s: string, cls: VerbClass): string {
  s = s.trim();
  if (s.endsWith("ます")) return fromMasu(s, cls);
  if (cls === "サ変" && !/する$/.test(s)) return s + "する";
  return s;
}

// サ変的外來語（リサイクルする）讀音是片假名，也算
const isKana = (s: string) => /^[ぁ-ゟ゠-ヿ]+$/.test(s);

/**
 * 單字「読みます［読む］」、讀音「よみます［よむ］」→ { dict: 読む, reading: よむ }。
 * 括號裡是辭書形就用括號裡的；沒有括號就從ます形推回去。看不懂的回傳 null。
 */
export function parseVerb(word: string, reading: string, cls: VerbClass): { dict: string; reading: string; cls: VerbClass } | null {
  // 「あそびます／あそぶ」：斜線後面是辭書形
  const lastPart = (x: string) => x.split(/[／/]/).map((t) => t.trim()).filter(Boolean).at(-1) ?? "";
  const inner = (m: RegExpMatchArray | null) => (m ? m[1].replace(/^[辭辞]書形[：:]\s*/, "").trim() : null);
  const wIn = inner(word.match(BRACKET));
  const rIn = inner(reading.match(BRACKET));
  let w = (wIn ?? lastPart(word.replace(BRACKET, ""))).trim();
  let r = lastPart(reading.replace(BRACKET, ""));
  // 讀音括號裡是平假名辭書形（よみます［よむ］）就直接用；是漢字（よみます（読む））就從ます形推
  if (rIn && isKana(rIn)) r = rIn;
  w = toDict(w, cls);
  r = toDict(r, cls);
  if (!w || !r || !isKana(r)) return null;
  // 漢字和讀音的結尾要對得上（送假名），不然算不出漢字版本
  if (w.slice(-1) !== r.slice(-1)) return null;
  // 「入ってくる」常被標成五段，其實是カ変
  if (cls === "五段" && r.endsWith("てくる")) cls = "カ変";
  return { dict: w, reading: r, cls };
}

// ── 活用 ─────────────────────────────────────────────

const ROW: Record<string, [a: string, i: string, e: string, o: string]> = {
  う: ["わ", "い", "え", "お"],
  く: ["か", "き", "け", "こ"],
  ぐ: ["が", "ぎ", "げ", "ご"],
  す: ["さ", "し", "せ", "そ"],
  つ: ["た", "ち", "て", "と"],
  ぬ: ["な", "に", "ね", "の"],
  ぶ: ["ば", "び", "べ", "ぼ"],
  む: ["ま", "み", "め", "も"],
  る: ["ら", "り", "れ", "ろ"],
};

const TE: Record<string, string> = { う: "って", つ: "って", る: "って", む: "んで", ぶ: "んで", ぬ: "んで", く: "いて", ぐ: "いで", す: "して" };

// いらっしゃる・おっしゃる・くださる・なさる・ござる：ます形與命令形是「い」
const HONORIFIC_GODAN = /(いらっしゃる|おっしゃる|くださる|なさる|ござる)$/;

/** 平假名辭書形 → 該形（只有讀音），沒有這個形回傳 null */
function conjugateKana(r: string, cls: VerbClass, form: Exclude<VerbForm, "尊敬">): string | null {
  if (cls === "サ変") {
    const s = r.replace(/する$/, "");
    const t: Record<typeof form, string> = {
      ます: "します", ない: "しない", て: "して", た: "した", 可能: "できる", 意向: "しよう",
      條件: "すれば", 受身: "される", 命令: "しろ", 禁止: "するな",
    };
    return s + t[form];
  }
  if (cls === "カ変") {
    const s = r.replace(/くる$/, "");
    const t: Record<typeof form, string> = {
      ます: "きます", ない: "こない", て: "きて", た: "きた", 可能: "こられる", 意向: "こよう",
      條件: "くれば", 受身: "こられる", 命令: "こい", 禁止: "くるな",
    };
    return s + t[form];
  }
  if (cls === "一段") {
    const s = r.replace(/る$/, "");
    const t: Record<typeof form, string> = {
      ます: "ます", ない: "ない", て: "て", た: "た", 可能: "られる", 意向: "よう",
      條件: "れば", 受身: "られる", 命令: "ろ", 禁止: "るな",
    };
    return s + t[form];
  }
  // 五段
  const last = r.slice(-1);
  const row = ROW[last];
  if (!row) return null;
  const s = r.slice(0, -1);
  const [a, i, e, o] = row;
  const honorific = HONORIFIC_GODAN.test(r);
  const iku = r.endsWith("いく"); // 行く（含 出ていく）的て形是「いって」
  switch (form) {
    case "ます":
      return s + (honorific ? "い" : i) + "ます";
    case "ない":
      return r === "ある" ? "ない" : s + a + "ない";
    case "て":
      return s + (iku ? "って" : TE[last]);
    case "た":
      return s + (iku ? "って" : TE[last]).replace(/て$/, "た").replace(/で$/, "だ");
    case "可能":
      return s + e + "る";
    case "意向":
      return s + o + "う";
    case "條件":
      return s + e + "ば";
    case "受身":
      return s + a + "れる";
    case "命令":
      return s + (honorific ? "い" : e);
    case "禁止":
      return r + "な";
  }
}

// 尊敬動詞（特別形），key 是辭書形讀音
const HONORIFIC: Record<string, { reading: string; word: string }> = {
  いく: { reading: "いらっしゃる", word: "いらっしゃる" },
  くる: { reading: "いらっしゃる", word: "いらっしゃる" },
  いる: { reading: "いらっしゃる", word: "いらっしゃる" },
  たべる: { reading: "めしあがる", word: "召し上がる" },
  のむ: { reading: "めしあがる", word: "召し上がる" },
  いう: { reading: "おっしゃる", word: "おっしゃる" },
  みる: { reading: "ごらんになる", word: "ご覧になる" },
  する: { reading: "なさる", word: "なさる" },
  くれる: { reading: "くださる", word: "くださる" },
  ねる: { reading: "おやすみになる", word: "お休みになる" },
  しっている: { reading: "ごぞんじだ", word: "ご存じだ" },
  きる: { reading: "おめしになる", word: "お召しになる" },
};

export type Conjugated = { word: string; reading: string };

/** 某個動詞的某一形；沒有（例如沒有特別尊敬形）回傳 null */
export function conjugate(v: Pick<Verb, "dict" | "reading" | "cls">, form: VerbForm): Conjugated | null {
  if (form === "尊敬") return HONORIFIC[v.reading] ?? null;
  const r = conjugateKana(v.reading, v.cls, form);
  if (!r) return null;
  // 漢字版：讀音裡會變的部分接在漢字詞幹後面
  let keep = 0; // 漢字詞與讀音結尾相同的假名數
  while (keep < v.dict.length && keep < v.reading.length && v.dict.at(-1 - keep) === v.reading.at(-1 - keep)) keep++;
  if (v.cls === "カ変" && /[来來]る$/.test(v.dict)) {
    // 来る：漢字不變，讀音的第一個假名（く／こ／き）藏在漢字裡
    const base = v.dict.slice(0, -2);
    const kanaBase = v.reading.slice(0, -2);
    return { word: base + "来" + r.slice(kanaBase.length + 1), reading: r };
  }
  const stemWord = v.dict.slice(0, v.dict.length - keep);
  const stemKana = v.reading.slice(0, v.reading.length - keep);
  if (!r.startsWith(stemKana)) return { word: r, reading: r };
  return { word: stemWord + r.slice(stemKana.length), reading: r };
}

/** 作答可接受漢字或假名寫法；忽略空白和句點 */
export function checkConjugation(answer: string, right: Conjugated): boolean {
  const n = (s: string) => s.normalize("NFKC").replace(/[\s。、.]/g, "");
  const a = n(answer);
  return a === n(right.word) || a === n(right.reading);
}

/** 哪些形適用這類動詞（尊敬只限特別形） */
export function formsFor(v: Pick<Verb, "reading">, forms: readonly VerbForm[]): VerbForm[] {
  return forms.filter((f) => f !== "尊敬" || Boolean(HONORIFIC[v.reading]));
}
