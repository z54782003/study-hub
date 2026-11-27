"use client";
import { useEffect, useState } from "react";
import { canSpeak, speak, type SpeechLang } from "@/lib/speech";
import type { AudioRef, VocabItem } from "@/lib/types";
import { Icon } from "./Icon";

/** 發音檔的語音 credit（VOICEVOX 角色規約要求標示）；gen-audio 換 --speaker 時這裡要跟著改 */
export const VOICE_CREDIT = "VOICEVOX:春日部つむぎ";

/** 發音檔的 credit：角色規約允許標在「任意の場所」，只在日文首頁底部標一次 */
export function VoiceCredit({ className = "" }: { className?: string }) {
  return <p className={`text-[11px] text-muted ${className}`}>單字、例句、搭配的發音檔：{VOICE_CREDIT}</p>;
}

// 同時只播一個：按下一個喇叭就停掉上一個
let current: HTMLAudioElement | null = null;

/** Notion 給的音檔網址一小時後失效：剩不到一分鐘就當過期 */
const isFresh = (a: AudioRef) => a.expires !== null && Date.parse(a.expires) - Date.now() > 60_000;

// 預先下載好的發音檔：fallback 路徑（每個檔固定不變）→ blob 網址。點喇叭時有就直接播，不用等從美國下載
const ready = new Map<string, string>();
const loading = new Set<string>();
const MAX_READY = 300; // 一個檔 5–15 KB，最多佔幾 MB

/**
 * 卡片一出現就在背景下載它的發音檔（Notion 的 S3 允許跨網域讀取；iPhone 的 Safari 不理 audio 的 preload，所以用 fetch）。
 * 網址快過期的不預載（點了再走轉址路徑），下載失敗就算了，點的時候照舊從網路播。
 */
export function preloadAudio(refs: (AudioRef | null | undefined)[]) {
  for (const a of refs) {
    if (!a || !isFresh(a) || ready.has(a.fallback) || loading.has(a.fallback)) continue;
    loading.add(a.fallback);
    fetch(a.url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b) return;
        if (ready.size >= MAX_READY) {
          const [oldKey, oldUrl] = ready.entries().next().value!;
          URL.revokeObjectURL(oldUrl);
          ready.delete(oldKey);
        }
        ready.set(a.fallback, URL.createObjectURL(b));
      })
      .catch(() => {})
      .finally(() => loading.delete(a.fallback));
  }
}

/** 一個單字卡上所有的發音檔（單字、例句、搭配） */
export const vocabAudioRefs = (w: VocabItem): (AudioRef | null | undefined)[] => [w.audio, ...w.examples.map((e) => e.audio), ...Object.values(w.usageAudio ?? {})];

/** 預先產生的發音檔（VOICEVOX）：先用預載好的；沒有就從網路播，Notion 的網址快過期就走 App 的轉址路徑。播不了才退回瀏覽器發音 */
function playAudio(a: AudioRef, fallback: () => void) {
  if (canSpeak()) window.speechSynthesis.cancel();
  current?.pause();
  const el = new Audio(ready.get(a.fallback) ?? (isFresh(a) ? a.url : a.fallback));
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
