"use client";
import { useEffect, useState } from "react";
import { canSpeak, speak, type SpeechLang } from "@/lib/speech";
import type { AudioRef } from "@/lib/types";
import { Icon } from "./Icon";

// 同時只播一個：按下一個喇叭就停掉上一個
let current: HTMLAudioElement | null = null;

/** 預先產生的發音檔（VOICEVOX）；Notion 的網址快過期就走 App 的轉址路徑。播不了才退回瀏覽器發音 */
function playAudio(a: AudioRef, fallback: () => void) {
  if (canSpeak()) window.speechSynthesis.cancel();
  current?.pause();
  const fresh = a.expires !== null && Date.parse(a.expires) - Date.now() > 60_000;
  const el = new Audio(fresh ? a.url : a.fallback);
  current = el;
  el.play().catch(() => {
    if (current === el) fallback();
  });
}

/** 喇叭按鈕：點了念出 text（不會觸發外層的翻卡、展開） */
/** keep：例句裡的單字（照寫的唸，跟單字按鈕一致） */
/** audio：有預先產生的音檔就播音檔，沒有才用瀏覽器發音 */
export function Speak({
  text,
  lang = "ja",
  label,
  className = "",
  keep,
  audio,
}: {
  text: string;
  lang?: SpeechLang;
  label?: string;
  className?: string;
  keep?: string;
  audio?: AudioRef | null;
}) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canSpeak() || !!audio), [audio]);
  if (!ok || !text) return null;
  return (
    <button
      type="button"
      aria-label={label ?? `念出「${text}」`}
      data-audio={audio ? "file" : "tts"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        current?.pause();
        if (audio) playAudio(audio, () => speak(text, lang, undefined, keep));
        else speak(text, lang, undefined, keep);
      }}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-card-2 ${className}`}
    >
      <Icon name="speaker" stroke={2} />
    </button>
  );
}
