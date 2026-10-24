import { describe, expect, it } from "vitest";
import { clipSummary } from "./events";

describe("clipSummary", () => {
  it("keeps short text", () => expect(clipSummary("A flaw. Fixed in 2.1.")).toBe("A flaw. Fixed in 2.1."));
  it("returns undefined for empty input", () => {
    expect(clipSummary(undefined)).toBeUndefined();
    expect(clipSummary("   ")).toBeUndefined();
  });
  it("ends at the last full sentence that fits", () => {
    const text = `${"First sentence is here. ".repeat(10)}Second part runs long ${"word ".repeat(80)}`;
    const out = clipSummary(text, 300)!;
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.endsWith(".")).toBe(true);
  });
  it("falls back to a whole word with an ellipsis", () => {
    const out = clipSummary(`Intro ${"averyverylongword ".repeat(40)}`, 100)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out).not.toMatch(/averyverylongwor…$/);
  });
});
