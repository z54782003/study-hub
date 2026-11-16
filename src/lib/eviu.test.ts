import { describe, expect, it } from "vitest";
import { eviuProgress } from "./eviu";

describe("EVIU progress", () => {
  it("counts Reviewing and Done like the Notion formula", () => {
    const units = [{ status: "Reviewing" }, { status: "Done" }, { status: "Studying" }, { status: "Not started" }, { status: null }];
    expect(eviuProgress(units)).toEqual({ done: 2, studying: 1, total: 5 });
  });
});
