import { describe, expect, it } from "vitest";
import { parseTadoku } from "./tadoku";

const entry = (id: string, level: string, title: string, extra = "") => `
<div class="bl-item" data-desc="…&lt;ruby&gt;…" data-order-level="${level}" data-date="1770374648">
  <div class="bl-thumb"><a href="https://tadoku.org/japanese/book/${id}/"><img decoding="async" src="https://tadoku.org/japanese/wp-content/uploads/${id}.jpg" loading="lazy"></a></div>
  <div class="bl-title">
    <a href="https://tadoku.org/japanese/book/${id}/">
      ${title}                        </a></div>
  <div class="bl-icons"><ul>
    <li><a href="https://tadoku.org/japanese/book-search?level=${level}" title="Level Start"><img src="x.png"/></a></li>
    <li><a href="https://tadoku.org/japanese/book-search?kind=020" title="レベル別読みもの"><img/></a></li>
    <li><a href="https://tadoku.org/japanese/book-search?attr=020" title="ふりがな付き"><img/></a></li>
    ${extra}
    <li class="bl-icons-free"><a href="https://tadoku.org/japanese/book/${id}/#bd-look-inside" title="無料の読みもの"><img/></a></li>
  </ul></div>
</div>`;

describe("parseTadoku", () => {
  it("reads title, level, link, cover and feature tags", () => {
    const html =
      entry("61273", "l-start", "ちょっと来て！") +
      entry("40182", "l0", "犬と肉〜イソップ物語より", '<li><a href="#" title="音声あり"><img/></a></li>') +
      entry("40182", "l0", "犬と肉〜イソップ物語より");
    expect(parseTadoku(html)).toEqual([
      {
        id: "61273",
        title: "ちょっと来て！",
        level: "Start",
        url: "https://tadoku.org/japanese/book/61273/",
        cover: "https://tadoku.org/japanese/wp-content/uploads/61273.jpg",
        tags: ["ふりがな付き"],
      },
      {
        id: "40182",
        title: "犬と肉〜イソップ物語より",
        level: "0",
        url: "https://tadoku.org/japanese/book/40182/",
        cover: "https://tadoku.org/japanese/wp-content/uploads/40182.jpg",
        tags: ["ふりがな付き", "音声あり"],
      },
    ]);
  });
  it("strips ruby from titles", () => expect(parseTadoku(entry("1", "l2", "<ruby>桃<rt>もも</rt></ruby>太郎"))[0].title).toBe("桃太郎"));
});
