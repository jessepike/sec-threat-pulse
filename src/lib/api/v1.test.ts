import { describe, expect, it } from "vitest";
import { API_EXCLUDED_SOURCES, parseApiVerdict } from "./v1";
import { actNowFeed } from "@/lib/feed";

describe("API source withholding", () => {
  it("withholds VulnCheck and sources with unclear terms, keeps open ones", () => {
    expect(API_EXCLUDED_SOURCES.has("vulncheck-kev")).toBe(true);
    expect(API_EXCLUDED_SOURCES.has("circl-sightings")).toBe(true);
    expect(API_EXCLUDED_SOURCES.has("cisa-kev")).toBe(false);
  });
  it("accepts only the three verdicts", () => {
    expect(parseApiVerdict("act_now")).toBe("act_now");
    expect(parseApiVerdict("ACT_NOW")).toBeNull();
    expect(parseApiVerdict(null)).toBeNull();
  });
});

describe("actNowFeed", () => {
  it("escapes text and links each event", () => {
    const xml = actNowFeed([{ id: "kev-1", title: "A & B: <x>", summary: "S", verdictReason: "R", updatedAt: "2026-10-25T00:00:00Z" }], "https://example.test");
    expect(xml).toContain("<title>A &amp; B: &lt;x&gt;</title>");
    expect(xml).toContain("<link>https://example.test/events/kev-1</link>");
    expect(xml).toContain("Why Act now: R");
  });
});
