import { describe, expect, it } from "vitest";
import { parseVoaArticle, parseVoaFeed } from "./voa";

describe("parseVoaFeed", () => {
  it("reads items", () => {
    const xml = `<rss><channel><title>Science &amp; Technology</title>
      <item><title>Wilbur and Orville Wright: The First Airplane</title>
        <description>Wilbur and Orville Wright quietly developed a powered flying machine. </description>
        <link>https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html</link>
        <pubDate>Mon, 17 Mar 2025 22:05:00 +0000</pubDate></item>
      <item><title>Barbara McClintock </title><description></description>
        <link>https://learningenglish.voanews.com/a/8010810.html</link><pubDate>Fri, 14 Mar 2025 16:28:15 +0000</pubDate></item>
    </channel></rss>`;
    expect(parseVoaFeed(xml)).toEqual([
      { id: "7998765", title: "Wilbur and Orville Wright: The First Airplane", description: "Wilbur and Orville Wright quietly developed a powered flying machine.", date: "2025-03-17" },
      { id: "8010810", title: "Barbara McClintock", description: "", date: "2025-03-14" },
    ]);
  });
});

describe("parseVoaArticle", () => {
  it("splits the story, credits and Words in This Story", () => {
    const html = `<h1 class="title pg-title">
        Wilbur and Orville Wright: The First Airplane
    </h1>
    <div class="wsw"><audio src="https://voa-audio.voanews.eu/vle/2025/03/05/e897.mp3" data-sources="[{&quot;Src&quot;:&quot;https://voa-audio.voanews.eu/vle/2025/03/05/e897_hq.mp3&quot;}]"></audio>
      <p>No media source currently available</p>
      <p>Wilbur and Orville Wright are the American <a href="#">inventors</a>.</p>
      <p>Wilbur Wright was born in 1867.</p>
      <p>I’m John Russell.</p>
      <p>Marilyn Rice Christiano wrote this story for VOA Learning English. John Russell adapted it.</p>
      <h2>Quiz - Wilbur and Orville Wright</h2>
      <p>______________________________________________________</p>
      <h2>Words in This Story</h2>
      <p><strong>glider</strong>– n. a flying object similar to an airplane but without an engine</p>
      <p>Share</p>
    </div><h2>Related</h2><p>Other story</p>`;
    expect(parseVoaArticle(html)).toEqual({
      title: "Wilbur and Orville Wright: The First Airplane",
      audio: "https://voa-audio.voanews.eu/vle/2025/03/05/e897.mp3",
      paragraphs: ["Wilbur and Orville Wright are the American inventors.", "Wilbur Wright was born in 1867."],
      words: [{ term: "glider", def: "n. a flying object similar to an airplane but without an engine" }],
      credit: ["I’m John Russell.", "Marilyn Rice Christiano wrote this story for VOA Learning English. John Russell adapted it."],
    });
  });
});
