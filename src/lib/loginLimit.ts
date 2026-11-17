// 登入嘗試次數限制：同一個來源連續錯 MAX 次，鎖 LOCK_MS。
// 記在記憶體裡（serverless 每個實例各記各的，重啟就清掉）——擋不住有心人，但能擋掉連續亂試。
const MAX = 5;
const LOCK_MS = 10 * 60_000;

type Entry = { fails: number; until: number };
const store = new Map<string, Entry>();

/** 還要等幾秒才能再試；0＝可以試 */
export function lockedFor(key: string, now = Date.now(), map = store): number {
  const e = map.get(key);
  if (!e || e.until <= now) return 0;
  return Math.ceil((e.until - now) / 1000);
}

export function recordFailure(key: string, now = Date.now(), map = store): void {
  const e = map.get(key);
  // 鎖定期過了就重新算
  const fails = e && (e.until === 0 || e.until > now) ? e.fails + 1 : 1;
  map.set(key, { fails, until: fails >= MAX ? now + LOCK_MS : 0 });
  if (map.size > 500) for (const [k, v] of map) if (v.until && v.until <= now) map.delete(k);
}

export const recordSuccess = (key: string, map = store) => void map.delete(key);
