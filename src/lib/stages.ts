import { STAGES, type Stage } from "./config";

/**
 * 某一天屬於哪個階段：第一個 end ≥ day 的階段。
 * 第一階段開始前（計畫改版當天 11/16）算階段 1；最後一個階段結束後維持最後一個，等計畫更新。
 */
export function stageFor(day: string, stages: Stage[] = STAGES): Stage {
  return stages.find((s) => day <= s.end) ?? stages[stages.length - 1];
}

/** 這一天出不出新的 N3 單字；debtCleared＝題庫 ❌／未作答已經沒有到期的 */
export function n3WordsOn(stage: Stage, day: string, debtCleared: boolean): boolean {
  const w = stage.n3Words;
  if (typeof w === "boolean") return w;
  return debtCleared || day >= w.from;
}

/** 這個階段的 N3 單字規則要不要先查題庫積壓 */
export const needsDebtCheck = (stage: Stage, day: string) => typeof stage.n3Words === "object" && day < stage.n3Words.from;

/**
 * 到期複習要出哪幾種題：
 * 期末衝刺＝題庫到期題；寒假清債＝題庫 ❌／未作答（N3 單字開始後加 N3 單字）；
 * 1 月期＝題庫＋N3 單字＋文型；4 月期＝題庫＋N3 到期字＋忘記的文型。
 */
export function reviewParts(stage: Stage, n3WordsActive: boolean): { quiz: Stage["quiz"]; n3: boolean; grammar: boolean } {
  return { quiz: stage.quiz, n3: stage.n3Review || n3WordsActive, grammar: stage.n3Review };
}

/** 還沒出新 N3 單字時，說明什麼時候開始（/n3 頁用） */
export function n3WordsStart(day: string, stages: Stage[] = STAGES): string {
  const cur = stageFor(day, stages);
  for (const s of stages.slice(stages.indexOf(cur))) {
    const w = s.n3Words;
    if (w === true) return s === cur ? "今天開始" : `${s.name}（${md(s.start)}）開始`;
    if (typeof w === "object") return `${s === cur ? "" : s.name}題庫積壓清空或 ${md(w.from)} 開始，先到的那天`;
  }
  return "單字量之後再定";
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
