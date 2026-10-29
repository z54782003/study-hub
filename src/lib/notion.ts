import "server-only";
import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse, QueryDataSourceParameters } from "@notionhq/client";

let client: Client | null = null;

export function hasNotion(): boolean {
  return Boolean(process.env.NOTION_TOKEN);
}

export function notion(): Client {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN 未設定");
  client ??= new Client({ auth: process.env.NOTION_TOKEN });
  return client;
}

export type Page = PageObjectResponse;
type Filter = QueryDataSourceParameters["filter"];
type Sorts = QueryDataSourceParameters["sorts"];

export async function queryAll(dataSourceId: string, filter?: Filter, sorts?: Sorts, max = 500): Promise<Page[]> {
  const pages: Page[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: dataSourceId,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: Math.min(100, max),
    });
    for (const r of res.results) if (isFullPage(r)) pages.push(r);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor && pages.length < max);
  return pages;
}

export async function getPage(id: string): Promise<Page> {
  const p = await notion().pages.retrieve({ page_id: id });
  if (!isFullPage(p)) throw new Error(`無法讀取頁面 ${id}`);
  return p;
}

// ── 讀屬性 ──────────────────────────────────────────
type Prop = Page["properties"][string];

function prop(p: Page, name: string): Prop | undefined {
  return p.properties[name];
}

const plain = (rich: { plain_text: string }[]) => rich.map((r) => r.plain_text).join("");

export function text(p: Page, name: string): string {
  const v = prop(p, name);
  if (!v) return "";
  if (v.type === "title") return plain(v.title);
  if (v.type === "rich_text") return plain(v.rich_text);
  if (v.type === "url") return v.url ?? "";
  return "";
}

export function select(p: Page, name: string): string | null {
  const v = prop(p, name);
  if (v?.type === "select") return v.select?.name ?? null;
  if (v?.type === "status") return v.status?.name ?? null;
  return null;
}

export function multiSelect(p: Page, name: string): string[] {
  const v = prop(p, name);
  return v?.type === "multi_select" ? v.multi_select.map((o) => o.name) : [];
}

export function date(p: Page, name: string): string | null {
  const v = prop(p, name);
  if (v?.type === "date") return v.date?.start?.slice(0, 10) ?? null;
  if (v?.type === "formula" && v.formula.type === "date") return v.formula.date?.start?.slice(0, 10) ?? null;
  return null;
}

export function num(p: Page, name: string): number {
  const v = prop(p, name);
  return v?.type === "number" ? (v.number ?? 0) : 0;
}

export function relationIds(p: Page, name: string): string[] {
  const v = prop(p, name);
  return v?.type === "relation" ? v.relation.map((r) => r.id) : [];
}

export function checkbox(p: Page, name: string): boolean {
  const v = prop(p, name);
  return v?.type === "checkbox" ? v.checkbox : false;
}

// ── 寫屬性 ──────────────────────────────────────────
export const w = {
  date: (iso: string) => ({ date: { start: iso } }),
  select: (name: string) => ({ select: { name } }),
  status: (name: string) => ({ status: { name } }),
  number: (n: number) => ({ number: n }),
  checkbox: (b: boolean) => ({ checkbox: b }),
  title: (s: string) => ({ title: [{ text: { content: s } }] }),
};

export async function updatePage(id: string, properties: Record<string, unknown>) {
  // SDK 的屬性型別是龐大的 union，這裡集中轉型一次
  await notion().pages.update({ page_id: id, properties: properties as never });
}
