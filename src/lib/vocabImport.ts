import "server-only";
// 暫時：把「初中級課本索引｜L〇」的 📒 單字表 補進 📖 單字庫（只補單字庫還沒有的字；用完刪掉）
import { isFullBlock } from "@notionhq/client";
import { DS, TEXTBOOK_INDEX_PARENT } from "./config";
import { notion, queryAll, select, text } from "./notion";

type Row = Record<string, string>;
const plain = (rt: { plain_text: string }[]) => rt.map((r) => r.plain_text).join("").trim();

async function children(id: string) {
  const out = [];
  let cursor: string | undefined;
  do {
    const res = await notion().blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 });
    out.push(...res.results.filter(isFullBlock));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

export const normWord = (s: string) => s.replace(/[〜～\s]/g, "").replace(/[（(]な[)）]$/, "").replace(/・?する$/, "");

async function tableRows(pageId: string): Promise<Row[]> {
  const blocks = await children(pageId);
  const start = blocks.findIndex((b) => b.type === "heading_2" && plain(b.heading_2.rich_text).includes("單字表"));
  if (start < 0) return [];
  const rows: Row[] = [];
  for (const b of blocks.slice(start + 1)) {
    if (b.type === "heading_2") break;
    if (b.type !== "table") continue;
    const cells = (await children(b.id)).flatMap((r) => (r.type === "table_row" ? [r.table_row.cells.map(plain)] : []));
    const [head, ...body] = cells;
    for (const c of body) rows.push(Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""])));
  }
  return rows;
}

function posOf(tag: string): string {
  if (tag.startsWith("名")) return "n. 名詞";
  if (tag.includes("類")) return "v. 動詞";
  if (/い形|な形/.test(tag)) return "adj. 形容詞";
  if (tag.startsWith("副")) return "adv. 副詞";
  if (/句型|招呼語/.test(tag)) return "phr. 片語";
  return "other";
}

function conjOf(tag: string, word: string): string | null {
  if (word === "来る" || word === "くる") return "カ変";
  if (tag.includes("Ⅰ類")) return "五段";
  if (tag.includes("Ⅱ類")) return "一段";
  if (tag.includes("Ⅲ類")) return "サ変";
  if (tag.includes("い形")) return "い形";
  if (tag.includes("な形")) return "な形";
  return null;
}

/** 單字表一列 → 單字庫屬性 */
export function toProps(r: Row, lesson: string, today: string) {
  const word = r["單字"];
  const usage = [
    ...(r["搭配"] ? r["搭配"].split("／").map((s) => s.trim()).filter(Boolean) : []),
    r["相關"] && `相關：${r["相關"]}`,
    r["⚠注意"] && `注意：${r["⚠注意"]}`,
  ].filter(Boolean) as string[];
  const sentence = r["課本原句"];
  const example = sentence && !/^[—\-①-⑳]/.test(sentence) && !sentence.includes("＿") ? sentence : "";
  const rt = (s: string) => ({ rich_text: s ? [{ text: { content: s.slice(0, 2000) } }] : [] });
  const conj = conjOf(r["標籤"] ?? "", word);
  return {
    單字: { title: [{ text: { content: word } }] },
    "音標/假名": rt(r["讀音"] ?? ""),
    中文翻譯: rt(r["中文"] ?? ""),
    詞性: { select: { name: posOf(r["標籤"] ?? "") } },
    ...(conj ? { 日文活用: { select: { name: conj } } } : {}),
    "搭配・用法": rt(usage.join("\n")),
    例句: rt(example),
    備註: rt(r["出處"] ? `課本索引 ${r["出處"]}` : ""),
    語言: { select: { name: "🇯🇵 日文" } },
    課次: { select: { name: lesson } },
    熟悉度: { status: { name: "未學" } },
    推播啟用: { checkbox: false },
    加入日期: { date: { start: today } },
  };
}

export async function importLesson(n: number, apply: boolean, today: string) {
  const pages = (await children(TEXTBOOK_INDEX_PARENT)).flatMap((b) =>
    b.type === "child_page" && b.child_page.title.startsWith("初中級課本索引") && new RegExp(`｜L${n}\\s`).test(b.child_page.title) ? [b.id] : [],
  );
  if (!pages.length) return { lesson: n, error: "找不到課本索引頁" };
  const rows = (await tableRows(pages[0])).filter((r) => r["單字"]);
  const lesson = `初中級 L${n}`;
  const existing = await queryAll(DS.vocab, { property: "課次", select: { equals: lesson } } as never, undefined, 1000);
  const have = new Set(existing.filter((p) => select(p, "語言") !== "🇬🇧 英文").map((p) => normWord(text(p, "單字"))));
  const missing = rows.filter((r) => !have.has(normWord(r["單字"])));
  if (apply)
    for (let i = 0; i < missing.length; i += 3)
      await Promise.all(
        missing.slice(i, i + 3).map((r) => notion().pages.create({ parent: { data_source_id: DS.vocab }, properties: toProps(r, lesson, today) as never })),
      );
  return {
    lesson: n,
    table: rows.length,
    inDb: existing.length,
    missing: missing.length,
    added: apply ? missing.length : 0,
    sample: missing.slice(0, 3).map((r) => toProps(r, lesson, today)),
    words: missing.map((r) => r["單字"]).join("、"),
  };
}
