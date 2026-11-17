"use client";
import { useEffect } from "react";

/** 註冊 service worker：看過的頁面離線時還能打開（public/sw.js） */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("service worker 註冊失敗", e));
  }, []);
  return null;
}
