import { describe, expect, it } from "vitest";
import { parseTadoku, parseTadokuBook, pdfKind, pdfProxyPath } from "./tadoku";

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

describe("parseTadokuBook", () => {
  it("finds the YouTube video, narration and PDFs", () => {
    const html = `<iframe src="https://www.youtube.com/embed/ReJug5QyW_I?rel=0"></iframe>
      <audio src="https://tadoku.org/japanese/wp-content/uploads/w0012a-inutoniku.mp3"></audio>
      <a href="https://tadoku.org/japanese/wp-content/uploads/w0012e-inutoniku-v3.pdf">e</a>
      <a href="https://tadoku.org/japanese/wp-content/uploads/w0012p-inutoniku-v3.pdf">p</a>
      <a href="https://tadoku.org/japanese/wp-content/uploads/w0012e-inutoniku-v3.pdf">again</a>`;
    expect(parseTadokuBook(html)).toEqual({
      youtube: "ReJug5QyW_I",
      audio: "https://tadoku.org/japanese/wp-content/uploads/w0012a-inutoniku.mp3",
      pdf: [
        "https://tadoku.org/japanese/wp-content/uploads/w0012e-inutoniku-v3.pdf",
        "https://tadoku.org/japanese/wp-content/uploads/w0012p-inutoniku-v3.pdf",
      ],
    });
  });
  it("handles books without media", () => expect(parseTadokuBook("<p>no media</p>")).toEqual({ youtube: null, audio: null, pdf: [] }));
});

describe("pdfKind", () => {
  it("reads the e/p letter right after the book number, not anywhere in the name", () => {
    expect(pdfKind("https://tadoku.org/japanese/wp-content/uploads/w0012e-inutoniku-v3.pdf")).toBe("screen");
    expect(pdfKind("https://tadoku.org/japanese/wp-content/uploads/w0012p-inutoniku-v3.pdf")).toBe("print");
    expect(pdfKind("https://tadoku.org/japanese/wp-content/uploads/w0034p-hime-no-hanashi.pdf")).toBe("print");
    expect(pdfKind("https://tadoku.org/japanese/wp-content/uploads/booklet.pdf")).toBeNull();
  });
});

describe("pdfProxyPath", () => {
  it("maps tadoku uploads to the same-origin path and refuses anything else", () => {
    expect(pdfProxyPath("https://tadoku.org/japanese/wp-content/uploads/w0012e-inutoniku-v3.pdf")).toBe("/tadoku-pdf/w0012e-inutoniku-v3.pdf");
    expect(pdfProxyPath("https://tadoku.org/japanese/wp-content/uploads/2020/05/x.pdf")).toBe("/tadoku-pdf/2020/05/x.pdf");
    expect(pdfProxyPath("https://tadoku.org/japanese/wp-content/uploads/../../x.pdf")).toBeNull();
    expect(pdfProxyPath("https://evil.example/japanese/wp-content/uploads/x.pdf")).toBeNull();
  });
});
