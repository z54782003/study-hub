import { rubyParts } from "@/lib/furigana";

/** 「漢字（かな）」顯示成漢字上方的小字讀音；word 有給就把單字標成強調色 */
export function Ruby({ text, word }: { text: string; word?: string }) {
  return rubyParts(text, word).map((p, i) => {
    // 不用 <ruby>（瀏覽器一律把漢字平均撐開）：讀音不比漢字寬就照常排；
    // 讀音（字級 0.5em）比漢字寬時才把這個詞撐到讀音寬度，免得和旁邊的讀音疊在一起（一生懸命（いっしょうけんめい）勉強（べんきょう））
    const wide = p.rt && [...p.rt].length * 0.5 > [...p.text].length;
    const body = p.rt ? (
      <span className="relative inline-block text-center" style={wide ? { minWidth: `${[...p.rt].length * 0.5 + 0.2}em` } : undefined}>
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
