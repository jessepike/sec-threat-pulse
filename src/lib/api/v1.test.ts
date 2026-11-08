import { describe, expect, it } from "vitest";
import { API_EXCLUDED_SOURCES, parseApiFilters, parseApiVerdict, type ApiEventSummary } from "./v1";
import { EVENT_REQUIRED_FIELDS, openApiDocument } from "./openapi";
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

describe("list filters", () => {
  const parse = (q: string) => parseApiFilters(new URLSearchParams(q));
  it("accepts product, cve and since and normalizes the CVE id", () => {
    expect(parse("product=fortinet/fortios&cve=cve-2026-12345&since=2026-11-01T00:00:00Z&page=2")).toEqual({
      filters: { verdict: null, page: 2, product: "fortinet/fortios", cve: "CVE-2026-12345", since: "2026-11-01T00:00:00Z" },
    });
  });
  it("rejects malformed values with a plain message", () => {
    expect(parse("verdict=urgent")).toEqual({ error: "verdict must be act_now, watch or low" });
    expect(parse("cve=12345")).toEqual({ error: "cve must look like CVE-2026-12345" });
    expect(parse("since=yesterday")).toEqual({ error: "since must be an ISO 8601 timestamp" });
  });
  it("defaults to page 1 and no filters", () => {
    expect(parse("")).toEqual({ filters: { verdict: null, page: 1, product: null, cve: null, since: null } });
  });
});

describe("OpenAPI document", () => {
  it("requires exactly the fields the summary type produces", () => {
    // A compile-time check that every required field exists on the type, and a runtime check of the reverse.
    const sample: Record<keyof ApiEventSummary, true> = {
      id: true, url: true, title: true, verdict: true, verdictReason: true, tier: true, rankScore: true, rankWhy: true, rulesVersion: true, ladder: true, cves: true, vendor: true, product: true,
      affectedProducts: true, category: true, summary: true, cvss: true, epss: true, exploitMaturity: true, kevListed: true, kevDateAdded: true, kevDueDate: true,
      firstSeenAt: true, updatedAt: true, newestEvidenceAt: true,
    };
    expect([...EVENT_REQUIRED_FIELDS].sort()).toEqual(Object.keys(sample).sort());
    const doc = openApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(["/api/v1/events", "/api/v1/events/{id}", "/api/v1/changes", "/api/v1/export/events-{date}.{format}", "/api/v1/track-record", "/api/v1/health"]);
    expect(doc.components.schemas.Change.required).toContain("previousVerdict");
  });
});
