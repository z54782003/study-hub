import { rubyParts } from "@/lib/furigana";

/** 「漢字（かな）」顯示成漢字上方的小字讀音；word 有給就把單字標成強調色 */
export function Ruby({ text, word }: { text: string; word?: string }) {
  return rubyParts(text, word).map((p, i) => {
    // 不用 <ruby>：讀音比漢字寬時瀏覽器會把漢字撐開；課本是讀音可以超出、漢字照常排
    const body = p.rt ? (
      <span className="relative inline-block">
        <span aria-hidden className="absolute bottom-full left-1/2 -translate-x-1/2 text-[0.5em] leading-none font-normal whitespace-nowrap">
          {p.rt}
        </span>
        {p.text}
      </span>
    ) : (
      p.text
    );
    return p.hit ? (
      <b key={i} className="text-accent">
        {body}
      </b>
    ) : (
      <span key={i}>{body}</span>
    );
  });
}
