// ISI 課堂筆記「複習」欄（select）：選項名稱照 Notion 現有的，不新增
export const NOTE_REVIEW_STEPS = ["未複習", "1回目 ✅", "2回目 ✅✅", "定着"] as const;
/** 使用者自己在 Notion 標的「要再看」 */
export const NOTE_REVIEW_AGAIN = "要再看";
export const NOTE_REVIEW_OPTIONS: readonly string[] = [...NOTE_REVIEW_STEPS, NOTE_REVIEW_AGAIN];

/** 按「標記已複習」之後的值：未複習（或空白、要再看）→ 1回目 → 2回目 → 定着；定着之後沒有下一步（null） */
export function nextNoteReview(current: string | null): string | null {
  if (!current || current === "未複習" || current === NOTE_REVIEW_AGAIN) return NOTE_REVIEW_STEPS[1];
  const i = (NOTE_REVIEW_STEPS as readonly string[]).indexOf(current);
  return i >= 0 && i < NOTE_REVIEW_STEPS.length - 1 ? NOTE_REVIEW_STEPS[i + 1] : null;
}

/** 已經至少複習過一次（今日頁「看今天的課堂筆記」自動打勾） */
export const noteReviewed = (v: string | null) => v === "1回目 ✅" || v === "2回目 ✅✅" || v === "定着";
