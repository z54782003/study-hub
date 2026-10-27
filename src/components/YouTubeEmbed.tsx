"use client";
import { useEffect, useId, useRef } from "react";
import { announcePlay, onOtherPlay } from "@/lib/exclusiveMedia";

// YouTube 內嵌：用 IFrame API 的 postMessage 知道它開始播，也能叫它暫停（不用載入 YouTube 的 JS）
export function YouTubeEmbed({ id: videoId, title }: { id: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const id = useId();
  const send = (msg: object) => ref.current?.contentWindow?.postMessage(JSON.stringify(msg), "*");

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data);
        if (data?.info?.playerState === 1) announcePlay(id);
      } catch {}
    };
    window.addEventListener("message", onMessage);
    const off = onOtherPlay(id, () => send({ event: "command", func: "pauseVideo", args: [] }));
    return () => {
      window.removeEventListener("message", onMessage);
      off();
    };
  }, [id]);

  return (
    <iframe
      ref={ref}
      src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      onLoad={() => send({ event: "listening", id })}
      className="h-full w-full border-0"
    />
  );
}
