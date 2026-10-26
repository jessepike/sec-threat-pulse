import { describe, expect, it } from "vitest";
import { isoDayPT, joinSentences } from "./format";

describe("joinSentences", () => {
  it("ends each text with a period before joining", () => {
    expect(joinSentences(["A discussed publicly (CIRCL sighting)", "Patch out now."])).toBe("A discussed publicly (CIRCL sighting). Patch out now.");
    expect(joinSentences(["First", " ", "Second!"])).toBe("First. Second!");
  });
});

describe("isoDayPT", () => {
  it("dates in Pacific time", () => {
    expect(isoDayPT(new Date("2026-10-26T03:00:00Z"))).toBe("2026-10-25");
  });
});
