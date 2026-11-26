/**
 * 日文發音音檔產生腳本（只在本機跑，不部署）。
 * 用 Mac 上的 VOICEVOX（http://localhost:50021）產生單字、例句和搭配・用法（一行一個）的 mp3，上傳到 Notion 單字庫的「發音檔」欄，
 * 並產生比對報告（CSV）。
 *
 * 準備：
 *   1. 打開 VOICEVOX App（引擎會在 localhost:50021）
 *   2. brew install ffmpeg
 *   3. study-hub 資料夾的 .env.local 有 NOTION_TOKEN（和 Vercel 上的同一個）
 *   4. npm install
 *
 * 用法：
 *   npm run gen-audio -- --voice-test
 *       三個角色各產同一組測試音檔（雨／飴、橋／箸、学生証、二十歳、今日＋兩句例句），只存在本機，不上傳。
 *   npm run gen-audio -- --lesson "初中級 L1" --speaker 春日部つむぎ
 *       產生並上傳一課；--dry-run 只比對讀音、出報告，不合成也不上傳。
 *   npm run gen-audio -- --all --speaker 春日部つむぎ
 *       全部日文單字。可以隨時 Ctrl-C，做完手上那個字就停；再跑一次會從沒做完的接著做
 *       （Notion 上已經有、內容沒變的音檔不會重產也不會重傳）。
 *   --force 不管 Notion 上有沒有，全部重產；--limit N 只做前 N 個字。
 *
 * 輸出（audio-out/，不進 git）：
 *   report-*.csv       每個音檔一列：我的讀音、引擎讀音、聲調、引擎重音、判定
 *   keep-one-*.csv     原本靠 KEEP_ONE 照原字唸的例句（と聞いて、棚…），確認沒有唸壞
 *   files/<課次>/      這次產生的 mp3（檔名是單字＋種類），方便直接聽「需抽查」的
 *   voice-test/<角色>/ 角色試聽和該角色的利用規約
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import {
  engineReading,
  finishSentence,
  FIXED_READINGS,
  JA_AUDIO_RULES,
  contourText,
  keepOneHits,
  notation,
  parseSentence,
  PITCH_SHAPE,
  planSentence,
  planWord,
  SENTENCE_VERDICT,
  SAY_AS_JA,
  sentenceInput,
  shapePitch,
  WORD_VERDICT,
  wordInput,
  type EnginePhrase,
  type Seg,
} from "../src/lib/jaAudio";
import {
  AUDIO_KINDS,
  AUDIO_PROPERTY,
  audioFileName,
  audioText,
  contentHash,
  genHash,
  parseAudioFileName,
  usageAudioTexts,
  type AudioKind,
  type AudioSource,
} from "../src/lib/jaAudioFiles";

const VOCAB_DS = "e4612b22-a490-4ba2-9ef5-11b2f07f8ccb";
const VOICEVOX = process.env.VOICEVOX_URL ?? "http://localhost:50021";
const OUT = "audio-out";
const VOICE_TEST_SPEAKERS = ["春日部つむぎ", "冥鳴ひまり", "青山龍星"];
const KIND_LABEL: Record<AudioKind, string> = { w: "單字", e1: "例句1", e2: "例句2", u: "搭配" };
// 合成參數（改了會讓所有音檔重產）
const SYNTH = { speedScale: 1, prePhonemeLength: 0.1, postPhonemeLength: 0.1, outputSamplingRate: 24000, outputStereo: false };

// ── 參數、環境 ───────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opts = (name: string) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
const opt = (name: string) => opts(name)[0];

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function die(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// ── VOICEVOX ─────────────────────────────────────────

type Mora = { text: string; consonant: string | null; consonant_length: number | null; vowel: string; vowel_length: number; pitch: number };
type AccentPhrase = EnginePhrase & { moras: Mora[]; pause_mora: Mora | null; is_interrogative: boolean };
type AudioQuery = { accent_phrases: AccentPhrase[]; kana?: string } & Record<string, unknown>;
type Speaker = { id: number; name: string; uuid: string };

async function vv(path: string, params: Record<string, string | number | boolean>, body?: unknown): Promise<Response> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const r = await fetch(`${VOICEVOX}${path}?${qs}`, {
    method: "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`VOICEVOX ${path} ${r.status}：${(await r.text()).slice(0, 200)}`);
  return r;
}
const audioQuery = async (text: string, sp: Speaker) => ({ ...((await (await vv("/audio_query", { text, speaker: sp.id })).json()) as AudioQuery), ...SYNTH });
const accentPhrases = async (text: string, sp: Speaker, isKana: boolean) =>
  (await (await vv("/accent_phrases", { text, speaker: sp.id, is_kana: isKana })).json()) as AccentPhrase[];
const moraData = async (phrases: AccentPhrase[], sp: Speaker) => (await (await vv("/mora_data", { speaker: sp.id }, phrases)).json()) as AccentPhrase[];
const synthesis = async (q: AudioQuery, sp: Speaker) => Buffer.from(await (await vv("/synthesis", { speaker: sp.id }, q)).arrayBuffer());

async function engineReady(): Promise<string> {
  try {
    const r = await fetch(`${VOICEVOX}/version`);
    return (await r.json()) as string;
  } catch {
    die(`連不到 VOICEVOX（${VOICEVOX}）。請先打開 VOICEVOX App。`);
  }
}

async function findSpeaker(name: string): Promise<Speaker> {
  const list = (await (await fetch(`${VOICEVOX}/speakers`)).json()) as { name: string; speaker_uuid: string; styles: { name: string; id: number }[] }[];
  const s = list.find((x) => x.name === name || x.styles.some((st) => String(st.id) === name));
  if (!s) die(`VOICEVOX 裡沒有「${name}」。有：${list.map((x) => x.name).join("、")}`);
  const style = s.styles.find((st) => String(st.id) === name) ?? s.styles.find((st) => st.name === "ノーマル") ?? s.styles[0];
  return { id: style.id, name: s.name, uuid: s.speaker_uuid };
}

function toMp3(wav: Buffer): Buffer {
  const dir = join(OUT, "tmp");
  mkdirSync(dir, { recursive: true });
  const src = join(dir, "in.wav");
  const dst = join(dir, "out.mp3");
  writeFileSync(src, wav);
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "24000", "-b:a", "48k", dst]);
  if (r.status !== 0) throw new Error(`ffmpeg 失敗：${r.stderr?.toString().slice(0, 200)}`);
  return readFileSync(dst);
}

// ── 合成：單字、例句 ─────────────────────────────────

type Row = {
  lesson: string;
  word: string;
  pageId: string;
  kind: AudioKind;
  /** 報告上的種類（搭配會編號：搭配1、搭配2…） */
  label?: string;
  input: string;
  mine: string;
  engine: string;
  pitch: string;
  engineAccent: string;
  notation: string;
  contour: string;
  verdict: string;
  note: string;
  file: string;
  status: string;
};

/** 單字：引擎讀音、重音和「音標/假名」「聲調」不一致就用我的假名＋聲調（AquesTalk 風記法）合成 */
async function makeWord(src: AudioSource, sp: Speaker, synth: boolean) {
  const input = wordInput(src.word)!;
  const q = await audioQuery(input, sp);
  const plan = planWord(src, q.accent_phrases);
  let nota = "";
  if (plan.override) {
    // 先讓引擎把我的假名轉成發音（長音、無聲化照引擎的），再合成一個重音句、套上聲調
    const mine = await accentPhrases(plan.kana, sp, false);
    if (plan.accent === null) q.accent_phrases = mine;
    else {
      const moras = mine.flatMap((p) => p.moras);
      const accent = Math.min(plan.accent, moras.length);
      nota = notation(moras.map((m) => m.text), accent);
      try {
        q.accent_phrases = await accentPhrases(nota, sp, true);
      } catch {
        q.accent_phrases = await moraData([{ ...mine[0], moras, accent, pause_mora: null }], sp);
      }
    }
  }
  // 有聲調：照東京式重音把每拍拉成清楚的高低（引擎的起伏太弱，平板詞詞尾會往下滑）
  let contour = "";
  if (src.pitch !== null && q.accent_phrases.length === 1) {
    // AccentPhrase 是 EnginePhrase 和引擎回傳的交集型別，moras 取引擎那一邊才有 pitch
    const moras = q.accent_phrases[0].moras as Mora[];
    const shaped = shapePitch(
      moras.map((m) => m.pitch),
      src.pitch,
    );
    moras.forEach((m, i) => (m.pitch = shaped[i]));
    contour = contourText(shaped, src.pitch);
  }
  return {
    plan,
    nota,
    contour,
    input,
    wav: synth ? await synthesis(q, sp) : null,
  };
}

/** 改送讀音的詞前面緊接著數字（20歳（はたち）、3件（さんけん））：送「20ハタチ」會唸成にじゅうはたち */
const digitOverride = (segs: Seg[], override: Set<number>) => [...override].some((i) => i > 0 && segs[i - 1].kind === "other" && /[0-9０-９]$/.test((segs[i - 1] as { text: string }).text));

const segReading = (segs: Seg[]) => segs.map((s) => (s.kind === "ruby" ? s.reading : s.kind === "punct" ? "" : s.text)).join("");

/** 例句：照「漢字（かな）」和讀音表比對引擎的讀音，不一致的詞改送讀音；語調用引擎預設 */
async function makeSentence(text: string, sp: Speaker, synth: boolean) {
  const segs = parseSentence(text);
  const q = await audioQuery(sentenceInput(segs), sp);
  const plan = planSentence(segs, q.accent_phrases);
  const q2 = plan.override.size ? await audioQuery(sentenceInput(segs, plan.override), sp) : q;
  const done = finishSentence(segs, plan, q2.accent_phrases);
  return {
    segs,
    done,
    engine: engineReading(q.accent_phrases) + (q2 !== q ? ` → ${engineReading(q2.accent_phrases)}` : ""),
    input: sentenceInput(segs, plan.override),
    wav: synth ? await synthesis(q2, sp) : null,
  };
}

// ── CSV ──────────────────────────────────────────────

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function writeCsv(path: string, header: string[], rows: string[][]) {
  writeFileSync(path, "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
}
const REPORT_HEADER = ["課次", "單字", "page id", "種類", "送引擎的文字", "我的讀音", "引擎讀音", "聲調", "引擎重音", "AquesTalk 記法", "每拍高低（塑形後）", "判定", "說明", "mp3", "狀態"];
const reportRow = (r: Row) => [r.lesson, r.word, r.pageId, r.label ?? KIND_LABEL[r.kind], r.input, r.mine, r.engine, r.pitch, r.engineAccent, r.notation, r.contour, r.verdict, r.note, r.file, r.status];
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
const safeName = (s: string) => s.replace(/[\/\\:*?"<>|\s]/g, "_").slice(0, 40);

// ── 試聽：三個角色 ─────────────────────────────────────

async function voiceTest(notion: Client | null) {
  let gakusei = { reading: "がくせいしょう", pitch: null as number | null };
  if (notion) {
    const hit = (await notion.dataSources.query({ data_source_id: VOCAB_DS, filter: { property: "單字", title: { equals: "学生証" } }, page_size: 1 })).results.find(isFullPage);
    if (hit) gakusei = { reading: textProp(hit, "音標/假名") || gakusei.reading, pitch: numProp(hit, "聲調") };
  }
  const words: (Omit<AudioSource, "ex1" | "ex2" | "usage"> & { label: string })[] = [
    { label: "雨", word: "雨", reading: "あめ", pitch: 1 },
    { label: "飴", word: "飴", reading: "あめ", pitch: 0 },
    { label: "橋", word: "橋", reading: "はし", pitch: 2 },
    { label: "箸", word: "箸", reading: "はし", pitch: 1 },
    { label: "学生証", word: "学生証", ...gakusei },
    { label: "二十歳", word: "二十歳", reading: "はたち", pitch: 1 },
    { label: "今日", word: "今日", reading: "きょう", pitch: 1 },
  ];
  const sentences = ["「明日（あした）は休（やす）みだ」と聞（き）いて、うれしくなりました。", "辞書（じしょ）は棚（たな）の上（うえ）にあります。"];
  const rows: string[][] = [];
  for (const name of VOICE_TEST_SPEAKERS) {
    const sp = await findSpeaker(name);
    const dir = join(OUT, "voice-test", name);
    mkdirSync(dir, { recursive: true });
    const info = (await (await fetch(`${VOICEVOX}/speaker_info?speaker_uuid=${sp.uuid}`)).json()) as { policy?: string };
    writeFileSync(join(dir, "利用規約.txt"), info.policy ?? "（引擎沒有回傳規約）");
    let n = 0;
    for (const w of words) {
      const r = await makeWord({ ...w, ex1: "", ex2: "", usage: "" }, sp, true);
      const file = join(dir, `${String(++n).padStart(2, "0")}_${w.label}.mp3`);
      writeFileSync(file, toMp3(r.wav!));
      rows.push([name, w.label, r.input, r.plan.kana, r.plan.engineKana, String(w.pitch ?? ""), String(r.plan.engineAccent ?? ""), [r.nota, r.contour].filter(Boolean).join(" "), r.plan.verdict, r.plan.note, file]);
    }
    for (const s of sentences) {
      const r = await makeSentence(s, sp, true);
      const file = join(dir, `${String(++n).padStart(2, "0")}_例句${sentences.indexOf(s) + 1}.mp3`);
      writeFileSync(file, toMp3(r.wav!));
      rows.push([name, s, r.input, segReading(r.segs), r.engine, "", "", "", r.done.verdict, r.done.note, file]);
    }
    console.log(`✓ ${name}（style ${sp.id}）：${n} 個檔 → ${dir}`);
  }
  const path = join(OUT, "voice-test", "voice-test.csv");
  writeCsv(path, ["角色", "詞／例句", "送引擎的文字", "我的讀音", "引擎讀音", "聲調", "引擎重音", "AquesTalk 記法", "判定", "說明", "mp3"], rows);
  console.log(`\n報告：${path}\n各角色的利用規約：${join(OUT, "voice-test", "<角色>", "利用規約.txt")}`);
}

// ── Notion ───────────────────────────────────────────

type FileProp = { name: string; url: string };
const prop = (p: PageObjectResponse, name: string) => p.properties[name];
function textProp(p: PageObjectResponse, name: string): string {
  const v = prop(p, name);
  if (v?.type === "title") return v.title.map((t) => t.plain_text).join("");
  if (v?.type === "rich_text") return v.rich_text.map((t) => t.plain_text).join("");
  return "";
}
function numProp(p: PageObjectResponse, name: string): number | null {
  const v = prop(p, name);
  return v?.type === "number" ? v.number : null;
}
function selectProp(p: PageObjectResponse, name: string): string {
  const v = prop(p, name);
  return v?.type === "select" ? (v.select?.name ?? "") : "";
}
function filesProp(p: PageObjectResponse, name: string): FileProp[] {
  const v = prop(p, name);
  if (v?.type !== "files") return [];
  return v.files.flatMap((f) => (f.type === "file" ? [{ name: f.name, url: f.file.url }] : []));
}

/** 429、5xx、逾時就等一下再試（Notion 大約每秒 3 次） */
async function retry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      const code = (e as { code?: string }).code ?? "";
      const transient = status === 429 || status >= 500 || /timeout|ECONNRESET|fetch failed/i.test(code + String(e));
      if (!transient || i >= 5) throw e;
      const wait = 1000 * 2 ** i;
      console.warn(`  ${label}：${status || code} ，${wait / 1000} 秒後重試`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function queryPages(notion: Client, lessons: string[]): Promise<PageObjectResponse[]> {
  const out: PageObjectResponse[] = [];
  let cursor: string | undefined;
  const ja = { property: "語言", select: { equals: "🇯🇵 日文" } };
  const filter = lessons.length ? { and: [ja, { or: lessons.map((l) => ({ property: "課次", select: { equals: l } })) }] } : ja;
  do {
    const res = await retry("讀取單字庫", () =>
      notion.dataSources.query({ data_source_id: VOCAB_DS, filter: filter as never, sorts: [{ timestamp: "created_time", direction: "ascending" }], start_cursor: cursor, page_size: 100 }),
    );
    out.push(...res.results.filter(isFullPage));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

async function uploadMp3(notion: Client, buf: Buffer, name: string): Promise<string> {
  const fu = await retry("建立上傳", () => notion.fileUploads.create({ mode: "single_part", filename: name, content_type: "audio/mpeg" }));
  await retry("上傳檔案", () => notion.fileUploads.send({ file_upload_id: fu.id, file: { filename: name, data: new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }) } }));
  return fu.id;
}

// ── 主流程：一課或全部 ─────────────────────────────────

async function run(notion: Client, lessons: string[], speakerName: string) {
  const dry = flag("dry-run");
  const force = flag("force");
  const limit = Number(opt("limit") ?? Infinity);
  const sp = await findSpeaker(speakerName);
  const settings = { rules: JA_AUDIO_RULES, speaker: [sp.name, sp.id], synth: SYNTH, table: FIXED_READINGS, sayAs: SAY_AS_JA };
  const gen = genHash(settings);
  // 有聲調的單字另外帶上音高塑形的版本：改塑形規則只重產這些，例句和沒聲調的單字不動
  const genShaped = genHash({ ...settings, pitchShape: PITCH_SHAPE });
  console.log(`語者：${sp.name}（style ${sp.id}），設定雜湊 ${gen}（有聲調的單字 ${genShaped}）${dry ? "，只比對不上傳" : ""}`);

  let stop = false;
  process.on("SIGINT", () => {
    if (stop) process.exit(130);
    stop = true;
    console.log("\n收到 Ctrl-C：做完這個字就停（再按一次立刻結束）。下次執行會接著做。");
  });

  const pages = (await queryPages(notion, lessons)).slice(0, limit);
  console.log(`${lessons.length ? lessons.join("、") : "全部日文單字"}：${pages.length} 個字`);
  const rows: Row[] = [];
  const keepRows: string[][] = [];
  const label = safeName(lessons.join("+") || "all");
  const runStamp = stamp();
  const flush = () => {
    writeCsv(join(OUT, `report-${label}-${runStamp}.csv`), REPORT_HEADER, rows.map(reportRow));
    writeCsv(join(OUT, `keep-one-${label}-${runStamp}.csv`), ["課次", "單字", "種類", "原本靠 KEEP_ONE 的地方", "例句", "判定", "說明", "mp3"], keepRows);
  };
  let done = 0;
  let made = 0;
  for (const page of pages) {
    if (stop) break;
    const src: AudioSource = { word: textProp(page, "單字"), reading: textProp(page, "音標/假名"), pitch: numProp(page, "聲調"), ex1: textProp(page, "例句"), ex2: textProp(page, "例句2"), usage: textProp(page, "搭配・用法") };
    const lesson = selectProp(page, "課次");
    const existing = filesProp(page, AUDIO_PROPERTY);
    // 這頁該有的音檔：單字、例句各一個，搭配一行一個（檔名＝種類＋內容雜湊＋設定雜湊）
    const targets: { kind: AudioKind; label: string; text: string; name: string }[] = [];
    for (const kind of AUDIO_KINDS) {
      const t = audioText(kind, src);
      if (t) targets.push({ kind, label: KIND_LABEL[kind], text: t, name: audioFileName(kind, contentHash(kind, t), kind === "w" && src.pitch !== null ? genShaped : gen) });
    }
    usageAudioTexts(src).forEach((t, i) => targets.push({ kind: "u", label: `${KIND_LABEL.u}${i + 1}`, text: t, name: audioFileName("u", contentHash("u", t), gen) }));
    const wanted = new Set(targets.map((t) => t.name));
    const base = { lesson, word: src.word, pageId: page.id, input: "", mine: "", engine: "", pitch: src.pitch === null ? "" : String(src.pitch), engineAccent: "", notation: "", contour: "", note: "", file: "" };
    if (/[〜～~]/.test(src.word)) rows.push({ ...base, kind: "w", verdict: WORD_VERDICT.skip, status: "跳過（App 用瀏覽器發音）" });

    const uploads: { kind: AudioKind; name: string; id: string }[] = [];
    try {
      for (const { kind, label, text, name } of targets) {
        const have = existing.some((f) => f.name === name);
        if (have && !force) {
          rows.push({ ...base, kind, label, verdict: "", status: "Notion 上已有、沒變（略過）", file: name });
          continue;
        }
        const listen = join(OUT, "files", safeName(lesson || "未分類"), `${safeName(src.word)}_${label}.mp3`);
        if (kind === "w") {
          const r = await makeWord(src, sp, !dry);
          rows.push({ ...base, kind, label, input: r.input, mine: r.plan.kana, engine: r.plan.engineKana, engineAccent: String(r.plan.engineAccent ?? ""), notation: r.nota, contour: r.contour, verdict: r.plan.verdict, note: r.plan.note, file: dry ? "" : listen, status: dry ? "只比對" : "新產生" });
          if (r.wav) uploads.push({ kind, name, id: await save(notion, r.wav, name, listen) });
        } else {
          // 搭配：讀音沒把握的（夾中文、沒標振假名、引擎還是唸不對、數字＋整串讀音）不產，App 照舊用瀏覽器發音
          if (kind === "u") {
            const c = await makeSentence(text, sp, false);
            const why = c.done.verdict === SENTENCE_VERDICT.check ? c.done.note : /[＋+]/.test(text) ? "句型公式（V＋やすい）" : digitOverride(c.segs, c.done.override) ? "數字後面的振假名包含數字讀音（20歳（はたち））" : "";
            if (why) {
              rows.push({ ...base, kind, label, input: c.input, mine: segReading(c.segs), engine: c.engine, verdict: c.done.verdict, note: why, status: "跳過（讀音沒把握，App 用瀏覽器發音）" });
              continue;
            }
          }
          const r = await makeSentence(text, sp, !dry);
          rows.push({ ...base, kind, label, input: r.input, mine: segReading(r.segs), engine: r.engine, verdict: r.done.verdict, note: r.done.note, file: dry ? "" : listen, status: dry ? "只比對" : "新產生" });
          for (const hit of keepOneHits(r.segs)) keepRows.push([lesson, src.word, label, hit, text, r.done.verdict, r.done.note, dry ? "" : listen]);
          if (r.wav) uploads.push({ kind, name, id: await save(notion, r.wav, name, listen) });
        }
      }
      if (uploads.length || (!dry && existing.some((f) => !wanted.has(f.name)))) await attach(notion, page.id, existing, wanted, uploads);
      made += uploads.length;
    } catch (e) {
      rows.push({ ...base, kind: "w", verdict: "", note: e instanceof Error ? e.message : String(e), status: "錯誤（下次重跑會再試）" });
      console.error(`  ✗ ${src.word}：${e instanceof Error ? e.message : e}`);
    }
    done++;
    if (done % 10 === 0 || done === pages.length) {
      console.log(`  ${done}/${pages.length}，這次上傳 ${made} 個檔`);
      flush();
    }
  }
  flush();
  const count = (v: string) => rows.filter((r) => r.verdict.startsWith(v)).length;
  console.log(
    `\n${stop ? "中斷" : "完成"}：${done}/${pages.length} 個字，這次上傳 ${made} 個檔。` +
      `一致 ${count("一致")}、已覆蓋 ${count("已用我的資料覆蓋")}、需抽查 ${rows.filter((r) => r.verdict.includes("需抽查")).length}、跳過 ${count("跳過")}` +
      `\n報告：${join(OUT, `report-${label}-${runStamp}.csv`)}\nKEEP_ONE：${join(OUT, `keep-one-${label}-${runStamp}.csv`)}（${keepRows.length} 句）`,
  );
}

/** 轉 mp3、存一份在本機（方便聽），上傳到 Notion，回傳上傳 id */
async function save(notion: Client, wav: Buffer, name: string, listen: string): Promise<string> {
  const mp3 = toMp3(wav);
  mkdirSync(join(listen, ".."), { recursive: true });
  writeFileSync(listen, mp3);
  return uploadMp3(notion, mp3, name);
}

/** 寫回「發音檔」欄：保留沒變的、換掉有變的、拿掉不再需要的（例句、搭配刪掉或改了） */
async function attach(notion: Client, pageId: string, existing: FileProp[], wanted: Set<string>, uploads: { kind: AudioKind; name: string; id: string }[]) {
  const uploaded = new Set(uploads.map((u) => u.name));
  const keep = existing.filter((f) => wanted.has(f.name) && !uploaded.has(f.name));
  const files = [
    ...keep.map((f) => ({ type: "file" as const, file: { url: f.url }, name: f.name })),
    ...uploads.map((u) => ({ type: "file_upload" as const, file_upload: { id: u.id }, name: u.name })),
  ];
  await retry("寫回發音檔", () => notion.pages.update({ page_id: pageId, properties: { [AUDIO_PROPERTY]: { files } } as never }));
}

// ── 進入點 ───────────────────────────────────────────

async function main() {
  loadEnv();
  mkdirSync(OUT, { recursive: true });
  const version = await engineReady();
  console.log(`VOICEVOX ${version}`);
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    die("找不到 ffmpeg。請先執行：brew install ffmpeg");
  }
  const token = process.env.NOTION_TOKEN;
  const notion = token ? new Client({ auth: token }) : null;
  if (flag("voice-test")) return voiceTest(notion);
  if (!notion) die("沒有 NOTION_TOKEN（放在 study-hub 的 .env.local）");
  const lessons = opts("lesson");
  if (!lessons.length && !flag("all")) die('要指定 --lesson "初中級 L1"（可以給好幾個）或 --all');
  const speaker = opt("speaker");
  if (!speaker) die(`要指定 --speaker（例如 ${VOICE_TEST_SPEAKERS.join("、")}）`);
  await run(notion, flag("all") ? [] : lessons, speaker);
}

main().catch((e) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
