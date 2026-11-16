// 🎧 TED Log「進度」（status）：待做 → 今天做 → 完成 → 已複習。Notion 的進度（12/31 前 36 支）數「完成」和「已複習」。
export const TED_OPEN = ["待做", "今天做"] as const;
export const tedFinished = (progress: string | null) => progress === "完成" || progress === "已複習";

/**
 * 做完／取消做完要寫回的欄位；null＝不用改。
 * 做完：進度改「完成」、完成日填今天；已經是完成／已複習就只補空白的完成日（不會把「已複習」改回「完成」）。
 * 取消：進度改回原本的（待做／今天做，不知道就「今天做」），清掉完成日。
 */
export function tedDoneChange(
  current: { progress: string | null; doneDate: string | null },
  done: boolean,
  today: string,
  prev?: string | null,
): { progress?: string; doneDate?: string | null } | null {
  if (done) {
    if (!tedFinished(current.progress)) return { progress: "完成", doneDate: today };
    return current.doneDate ? null : { doneDate: today };
  }
  if (!tedFinished(current.progress)) return null;
  return { progress: (TED_OPEN as readonly string[]).includes(prev ?? "") ? (prev as string) : "今天做", doneDate: null };
}
