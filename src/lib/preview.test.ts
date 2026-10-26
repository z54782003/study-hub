import { describe, expect, it } from "vitest";
import { pickPreviewPage } from "./preview";

const page = (title: string, createdTime: string) => ({ id: title, title, createdTime });

describe("pickPreviewPage", () => {
  it("matches the date at the start of the title, ignoring a leading emoji", () => {
    const pages = [page("10/2（金）預習｜L1", "2026-10-01T23:30:00Z"), page("🌅 10/26（月）預習｜L3", "2026-10-25T23:37:00Z")];
    expect(pickPreviewPage(pages, "2026-10-26", "Asia/Tokyo")?.title).toBe("🌅 10/26（月）預習｜L3");
    expect(pickPreviewPage(pages, "2026-10-02", "Asia/Tokyo")?.title).toBe("10/2（金）預習｜L1");
  });
  it("falls back to the page created today in Tokyo when the title date is off by one", () => {
    // 實際案例：東京 10/26 08:37 建立，標題卻是 10/25
    const pages = [page("10/23（金）預習｜L3", "2026-10-22T23:30:00Z"), page("10/25（日）預習｜L3", "2026-10-25T23:37:01Z")];
    expect(pickPreviewPage(pages, "2026-10-26", "Asia/Tokyo")?.title).toBe("10/25（日）預習｜L3");
  });
  it("returns null when nothing fits", () => {
    expect(pickPreviewPage([page("10/23（金）預習｜L3", "2026-10-22T23:30:00Z")], "2026-10-26", "Asia/Tokyo")).toBeNull();
  });
});
