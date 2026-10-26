"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** 跟讀錄音：每一句保留最後一次錄音（只存在記憶體，不上傳）。 */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [takes, setTakes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const start = useCallback(async (cueIndex: number) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const url = URL.createObjectURL(new Blob(chunks, { type: r.mimeType }));
        urls.current.push(url);
        setTakes((t) => ({ ...t, [cueIndex]: url }));
        setRecording(false);
      };
      r.start();
      rec.current = r;
      setRecording(true);
    } catch {
      setError("無法使用麥克風：請在瀏覽器設定允許麥克風");
    }
  }, []);

  const stop = useCallback(() => rec.current?.state === "recording" && rec.current.stop(), []);

  const play = useCallback((cueIndex: number) => {
    const url = takes[cueIndex];
    if (url) void new Audio(url).play();
  }, [takes]);

  return { recording, takes, error, start, stop, play };
}
