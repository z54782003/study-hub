"use client";
import { useEffect, useState } from "react";
import { canSpeak, speak, type SpeechLang } from "@/lib/speech";

/** 🔊 按鈕：點了念出 text（不會觸發外層的翻卡、展開） */
export function Speak({ text, lang = "ja", label, className = "" }: { text: string; lang?: SpeechLang; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canSpeak()), []);
  if (!ok || !text) return null;
  return (
    <button
      type="button"
      aria-label={label ?? `念出「${text}」`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speak(text, lang);
      }}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-base text-muted active:bg-line ${className}`}
    >
      🔊
    </button>
  );
}
