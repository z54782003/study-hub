// Study Hub 離線支援：看過的頁面沒網路時還能打開（唯讀）。作答、打勾仍然要連線。
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 只留最近的 120 個頁面
async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(keys.length - 120, 0))) await cache.delete(k);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // API、音檔、PDF、登入頁不快取
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/tadoku-pdf/") || url.pathname === "/login") return;
  if (req.headers.has("range")) return;

  // 建置產物檔名帶雜湊，內容不會變：先用快取
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // 頁面（含換頁時的 RSC 資料）：先連線拿最新的，連不上才用上次看到的
  event.respondWith(
    caches.open(PAGES).then(async (cache) => {
      try {
        const res = await fetch(req);
        // 被導去登入頁的回應不存
        if (res.ok && !res.redirected) {
          cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      } catch (e) {
        const hit = (await cache.match(req)) ?? (await cache.match(req, { ignoreSearch: true }));
        if (hit) return hit;
        throw e;
      }
    }),
  );
});
