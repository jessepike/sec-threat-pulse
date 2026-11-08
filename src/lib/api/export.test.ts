import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, csvCell, eventToCsvRow, parseExportName, toCsv } from "./export";
import type { ApiEventSummary } from "./v1";

const event: ApiEventSummary = {
  id: "kev-1",
  url: "https://securitythreatpulse.com/events/kev-1",
  title: 'Vendor "X", a flaw',
  verdict: "act_now",
  verdictReason: "Attacks are confirmed.",
  tier: "today",
  rankScore: 7,
  rankWhy: ["Exploitation confirmed"],
  rulesVersion: "v3",
  ladder: { talk: "confirmed", exposure: "none", attempts: "confirmed", exploited: "confirmed", damage: "none" },
  untrackedRungs: ["exposure", "damage"],
  cves: ["CVE-2026-1", "CVE-2026-2"],
  vendor: "Vendor",
  product: "X",
  affectedProducts: [{ kind: "direct", slug: "vendor/x", vendor: "Vendor", product: "X", evidence: ["kev"], vendorKey: "vendor", productKey: "x" }],
  category: { id: "edge", label: "Edge", why: "", doThis: "" },
  summary: "Line one\nline two",
  cvss: 9.8,
  epss: 0.5,
  exploitMaturity: "weaponized",
  kevListed: true,
  kevDateAdded: "2026-11-01",
  kevDueDate: "2026-11-15",
  firstSeenAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
  newestEvidenceAt: "2026-11-02T00:00:00.000Z",
};

describe("export names", () => {
  it("accepts dated and latest names in both formats", () => {
    expect(parseExportName("events-2026-11-08.csv")).toEqual({ date: "2026-11-08", format: "csv" });
    expect(parseExportName("events-latest.json")).toEqual({ date: "latest", format: "json" });
  });
  it("rejects other names and impossible dates", () => {
    expect(parseExportName("events.csv")).toBeNull();
    expect(parseExportName("events-2026-13-40.csv")).toBeNull();
    expect(parseExportName("../events-2026-11-08.csv")).toBeNull();
  });
});

describe("csv", () => {
  it("quotes commas, quotes and line breaks and leaves nulls empty", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("x\ny")).toBe('"x\ny"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(false)).toBe("false");
  });
  it("writes one row per event with every column", () => {
    const row = eventToCsvRow(event);
    expect(row).toHaveLength(EXPORT_COLUMNS.length);
    const csv = toCsv([event]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","));
    expect(lines[1]).toContain("kev-1,https://securitythreatpulse.com/events/kev-1,");
    expect(lines[1]).toContain("CVE-2026-1; CVE-2026-2");
    expect(lines[1]).toContain("confirmed,none,confirmed,confirmed,none");
  });
});
