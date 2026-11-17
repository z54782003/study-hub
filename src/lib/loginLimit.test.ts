import { describe, expect, it } from "vitest";
import { lockedFor, recordFailure, recordSuccess } from "./loginLimit";

describe("login limit", () => {
  it("locks after five failures and unlocks ten minutes later", () => {
    const map = new Map();
    for (let i = 0; i < 4; i++) recordFailure("ip", 1000, map);
    expect(lockedFor("ip", 1000, map)).toBe(0);
    recordFailure("ip", 1000, map);
    expect(lockedFor("ip", 1000, map)).toBe(600);
    expect(lockedFor("other", 1000, map)).toBe(0);
    expect(lockedFor("ip", 1000 + 600_000, map)).toBe(0);
    // 解鎖後重新算
    recordFailure("ip", 1000 + 600_001, map);
    expect(lockedFor("ip", 1000 + 600_001, map)).toBe(0);
  });
  it("forgets failures after a successful login", () => {
    const map = new Map();
    for (let i = 0; i < 4; i++) recordFailure("ip", 0, map);
    recordSuccess("ip", map);
    recordFailure("ip", 0, map);
    expect(lockedFor("ip", 0, map)).toBe(0);
  });
});
