// English Vocabulary in Use：📚 EVIU Units 的 Status 選項（照 Notion 現有的）
export const EVIU_STATUSES = ["Not started", "Studying", "Reviewing", "Done"] as const;
export type EviuStatus = (typeof EVIU_STATUSES)[number];

export type EviuUnit = {
  id: string;
  no: number;
  unit: string;
  theme: string | null;
  status: string | null;
  /** Studied 日期 */
  studied: string | null;
  url: string;
};

/** Notion 那邊的進度：Status 是 Reviewing 或 Done 的單元數 */
export const eviuCounted = (status: string | null) => status === "Reviewing" || status === "Done";

export function eviuProgress(units: Pick<EviuUnit, "status">[]): { done: number; studying: number; total: number } {
  return {
    done: units.filter((u) => eviuCounted(u.status)).length,
    studying: units.filter((u) => u.status === "Studying").length,
    total: units.length,
  };
}
