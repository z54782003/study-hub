/** 換頁時馬上顯示（伺服器還在讀 Notion），點下去不會像沒反應 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="載入中" className="animate-pulse space-y-3 pt-12">
      <div className="h-8 w-40 rounded-lg bg-card-2" />
      <div className="h-4 w-56 rounded bg-card-2" />
      <div className="h-28 rounded-2xl bg-card-2" />
      <div className="h-28 rounded-2xl bg-card-2" />
      <div className="h-28 rounded-2xl bg-card-2" />
    </div>
  );
}
