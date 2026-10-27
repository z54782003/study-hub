// 同一頁只讓一個媒體在播：開始播的發出事件，其他的收到就暫停（多読書頁的影片／朗讀二擇一）
const EVENT = "exclusive-media-play";

export function announcePlay(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** 別的媒體開始播時呼叫 pause；回傳取消監聽 */
export function onOtherPlay(id: string, pause: () => void): () => void {
  const handler = (e: Event) => (e as CustomEvent<string>).detail !== id && pause();
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
