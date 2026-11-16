/** blocks.children.list 回來的區塊，只取走訪需要的欄位 */
export type TreeBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  child_page?: { title: string };
  heading_1?: { is_toggleable?: boolean };
  heading_2?: { is_toggleable?: boolean };
  heading_3?: { is_toggleable?: boolean };
};

// 會往裡面找的容器：toggle、分欄，和可收合的標題（Notion 的 toggle heading）
const CONTAINERS = new Set(["toggle", "column_list", "column"]);
const isContainer = (b: TreeBlock) => {
  if (!b.has_children) return false;
  if (CONTAINERS.has(b.type)) return true;
  if (b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3") return Boolean(b[b.type]?.is_toggleable);
  return false;
};

/**
 * 依序找每個 parent 底下的子頁（child_page），包含放在 toggle／分欄裡的。
 * maxDepth＝最多往下打開幾層容器（3：parent → 分欄 → 欄 → toggle → 子頁 還找得到）。
 * 子頁本身不往下找；同一頁出現在好幾個 parent 只留第一次。
 * 某個 parent 讀不到（integration 沒連線）就交給 onError，繼續找下一個。
 */
export async function findChildPages(
  parents: string[],
  list: (id: string) => Promise<TreeBlock[]>,
  { maxDepth = 3, onError }: { maxDepth?: number; onError?: (parent: string, e: unknown) => void } = {},
): Promise<{ id: string; title: string }[]> {
  const out: { id: string; title: string }[] = [];
  const seen = new Set<string>();
  const walk = async (id: string, depth: number) => {
    for (const b of await list(id)) {
      if (b.type === "child_page" && b.child_page) {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          out.push({ id: b.id, title: b.child_page.title });
        }
      } else if (depth < maxDepth && isContainer(b)) {
        await walk(b.id, depth + 1);
      }
    }
  };
  for (const p of parents) {
    try {
      await walk(p, 0);
    } catch (e) {
      if (!onError) throw e;
      onError(p, e);
    }
  }
  return out;
}
