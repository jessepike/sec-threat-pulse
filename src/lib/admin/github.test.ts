import { describe, expect, it } from "vitest";
import { feedbackTitle } from "./github";

describe("feedbackTitle", () => {
  it("prefixes the topic and keeps a short first line", () => {
    expect(feedbackTitle("General", "Add a slogan\nmore detail")).toBe("[General] Add a slogan");
  });
  it("cuts a long first line at a word with an ellipsis", () => {
    const t = feedbackTitle("Phase 1: Data spine", "word ".repeat(40));
    expect(t.startsWith("[Phase 1: Data spine] word")).toBe(true);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThan(110);
  });
});
