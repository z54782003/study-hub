import { describe, expect, it } from "vitest";
import { addDays, diffDays, formatJP, todayISO } from "./dates";
import {
  dailySample,
  grammarIndexForDate,
  matchGrammar,
  n3BatchRange,
  n3NextLevel,
  quizNextInterval,
  quizUpdate,
  vocabUpdate,
  weekGrammarIndices,
} from "./srs";
import { GRAMMAR_ORDER } from "./config";

describe("dates", () => {
  it("handles month boundaries", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(diffDays("2026-10-08", "2026-12-18")).toBe(71);
  });
  it("formats in Japanese", () => {
    expect(formatJP("2026-10-27")).toBe("10/27（火）");
  });
  it("uses the given timezone", () => {
    // 2026-10-26 23:30 UTC = 10/27 08:30 in Tokyo
    expect(todayISO("Asia/Tokyo", new Date("2026-10-26T23:30:00Z"))).toBe("2026-10-27");
  });
});

describe("quiz bank SRS", () => {
  it("never-tested question goes from D+1 to D+3 when correct", () => {
    expect(quizNextInterval(null, "2026-10-10", true)).toBe(3);
  });
  it("climbs the ladder from the previous interval", () => {
    expect(quizNextInterval("2026-10-01", "2026-10-04", true)).toBe(7);
    expect(quizNextInterval("2026-10-01", "2026-10-08", true)).toBe(14);
    expect(quizNextInterval("2026-10-01", "2026-10-15", true)).toBe(30);
    expect(quizNextInterval("2026-09-01", "2026-10-01", true)).toBe(30);
  });
  it("resets to D+1 when wrong", () => {
    expect(quizNextInterval("2026-09-01", "2026-10-01", false)).toBe(1);
  });
  it("schedules from today, not from the old due date", () => {
    expect(quizUpdate("2026-10-27", null, "2026-09-07", true)).toEqual({
      lastTested: "2026-10-27",
      result: "✅ 對",
      nextReview: "2026-10-30",
    });
  });
});

describe("vocab familiarity", () => {
  it("wrong answer marks 忘記 and counts", () => {
    expect(vocabUpdate("熟悉", 5, 1, false)).toEqual({ status: "忘記", rightCount: 5, wrongCount: 2 });
  });
  it("忘記 recovers to 學習中, 學習中 needs 3 correct to become 熟悉", () => {
    expect(vocabUpdate("忘記", 0, 2, true).status).toBe("學習中");
    expect(vocabUpdate("學習中", 1, 0, true).status).toBe("學習中");
    expect(vocabUpdate("學習中", 2, 0, true).status).toBe("熟悉");
  });
});

describe("N3", () => {
  it("level transitions", () => {
    expect(n3NextLevel("未學", true)).toBe("學習中");
    expect(n3NextLevel("學習中", true)).toBe("熟悉");
    expect(n3NextLevel("熟悉", true)).toBe("精通");
    expect(n3NextLevel("精通", false)).toBe("忘記");
  });
  it("batch ranges restart on 10/27 and finish on 12/31", () => {
    expect(n3BatchRange("2026-10-26")).toBeNull();
    expect(n3BatchRange("2026-10-27")).toEqual({ lo: 0, hi: 40 });
    expect(n3BatchRange("2026-10-28")).toEqual({ lo: 40, hi: 80 });
    expect(n3BatchRange("2026-12-31")).toEqual({ lo: 2600, hi: 2640 });
    expect(n3BatchRange("2027-01-01")).toBeNull();
  });
  it("one grammar a day from 10/27, weekends included", () => {
    expect(grammarIndexForDate("2026-10-26")).toBeNull();
    expect(grammarIndexForDate("2026-10-27")).toBe(0);
    expect(grammarIndexForDate("2026-10-31")).toBe(4); // 土
    expect(grammarIndexForDate("2026-12-17")).toBe(51);
    expect(grammarIndexForDate("2026-12-18")).toBeNull();
  });
  it("weekend reviews what this week covered", () => {
    expect(weekGrammarIndices("2026-10-31")).toEqual([0, 1, 2, 3, 4]);
    expect(weekGrammarIndices("2026-11-08")).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });
  it("matches every grammar in the order list to exactly one real Notion title", () => {
    // 2026-10-26 從「N3 文法補強」資料庫讀到的實際標題
    const titles = [
      "〜からこそ", "〜うちに／〜ないうちに", "〜かわりに／〜反面", "〜ぎみ", "〜ば〜ほど／〜につれて／〜にしたがって",
      "〜わけにはいかない／〜ないわけにはいかない", "〜どころか／〜どころではない", "〜ていく／〜てくる", "〜しかない",
      "〜きる／〜きれない", "〜かのように（な）", "〜ず（に）", "〜っぽい", "〜からといって", "〜たとたん（に）", "〜たて",
      "使役受身（〜させられる）", "〜べき／〜べきではない", "謙讓語動詞表", "〜ながら（逆接）／〜つつ", "〜以上は／〜上で／〜上に",
      "〜ふりをする", "〜最中に", "〜おかげで／〜せいで", "〜に慣れる", "〜向け", "〜こともある", "〜として／〜とともに",
      "〜まま／〜きり／〜っぱなし", "〜に対して／〜に関して／〜について", "尊敬語動詞表", "〜によって／〜による／〜によると",
      "〜たばかり", "〜につき", "〜ものだ／〜ものではない", "〜ようとする", "〜ということだ", "〜的（な）", "〜出す",
      "〜わけだ／〜わけがない／〜わけではない", "〜ことはない", "〜において／〜における", "〜たびに／〜ついでに／〜とおりに",
      "〜恐れがある", "〜て初めて", "〜はず（だ／がない／だった）", "〜次第", "お〜になる／〜（ら）れる／お〜する", "〜がち",
      "〜に違いない／〜に決まっている", "〜さえ／〜こそ／〜すら", "〜を始め（として）",
    ];
    for (const name of GRAMMAR_ORDER) {
      expect(titles.filter((t) => matchGrammar(name, t)), name).toHaveLength(1);
    }
    expect(matchGrammar("〜うちに", "〜がち")).toBe(false);
  });
  it("daily sample is stable for the same seed", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ id: String(i) }));
    expect(dailySample(items, 10, "2026-10-27")).toEqual(dailySample(items, 10, "2026-10-27"));
    expect(dailySample(items, 10, "2026-10-27")).toHaveLength(10);
  });
});
