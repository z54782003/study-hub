// 逐字差異（作答卡「你寫的／改正」）：多寫的標刪除線，漏寫的標底色
export type DiffPart = { text: string; op: "same" | "del" | "ins" };

/** 以字元 LCS 比較 a（你寫的）和 b（改正），回傳兩行各自的片段 */
export function charDiff(a: string, b: string): { mine: DiffPart[]; fixed: DiffPart[] } {
  const x = [...a];
  const y = [...b];
  // 題目答案都是一兩句，O(n·m) 夠用；太長就不標
  if (x.length * y.length > 40000) return { mine: [{ text: a, op: "same" }], fixed: [{ text: b, op: "same" }] };
  const L = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const mine: DiffPart[] = [];
  const fixed: DiffPart[] = [];
  const push = (arr: DiffPart[], text: string, op: DiffPart["op"]) => {
    const last = arr.at(-1);
    if (last && last.op === op) last.text += text;
    else arr.push({ text, op });
  };
  let i = 0;
  let j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      push(mine, x[i], "same");
      push(fixed, y[j], "same");
      i++;
      j++;
    } else if (j < y.length && (i === x.length || L[i][j + 1] >= L[i + 1][j])) {
      push(fixed, y[j++], "ins");
    } else {
      push(mine, x[i++], "del");
    }
  }
  return { mine, fixed };
}
