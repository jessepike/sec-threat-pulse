import { describe, expect, it } from "vitest";
import { computeClock, sourceCounts } from "./clock";

const o = (sourceId: string, kind: string, publishedAt: string | null, extra: Partial<Parameters<typeof computeClock>[1][number]> = {}) => ({
  sourceId,
  kind,
  strength: "confirmed",
  title: `${sourceId} ${kind}`,
  url: `https://example.test/${sourceId}`,
  publishedAt,
  ...extra,
});

describe("computeClock", () => {
  it("assembles disclosure, exploit code, first report, KEV and the deadline with links", () => {
    const c = computeClock(
      [{ cveId: "CVE-2026-1", publishedAt: "2026-01-03T10:00:00Z", kevCisaDateAdded: "2026-01-09" }],
      [
        o("cisa-kev", "exploited", "2026-01-09T00:00:00Z", { metadata: { dueDate: "2026-01-30" } }),
        o("circl-sightings", "exploited", "2026-01-05T00:00:00Z", { strength: "reported", sourceName: "CIRCL sightings" }),
        o("metasploit", "exploit_available", "2026-01-07T00:00:00Z", { sourceName: "Metasploit" }),
        o("exploitdb", "exploit_available", "2026-01-06T00:00:00Z"),
        o("ransomware-live", "claim", "2026-01-02T00:00:00Z", { strength: "claimed" }),
      ],
    );
    expect(c.disclosed).toMatchObject({ date: "2026-01-03", label: "CVE-2026-1 published" });
    expect(c.exploitCode).toMatchObject({ date: "2026-01-06", label: "exploitdb" });
    expect(c.firstReport).toMatchObject({ date: "2026-01-05", label: "CIRCL sightings", url: "https://example.test/circl-sightings" });
    expect(c.kevListed).toMatchObject({ date: "2026-01-09" });
    expect(c.kevDue).toMatchObject({ date: "2026-01-30" });
    expect(c.daysToFirstReport).toBe(2);
    expect(c.daysToKev).toBe(6);
  });

  it("leaves unknown dates missing and never invents them", () => {
    const c = computeClock([{ cveId: "CVE-2026-2" }], [o("hibp", "damage", null)]);
    expect(c).toEqual({});
  });

  it("never backdates a report to the disclosure date for sources that only carry it", () => {
    const c = computeClock(
      [{ cveId: "CVE-2026-4", publishedAt: "2026-03-01" }],
      [
        o("metasploit", "exploit_available", "2026-03-01T00:00:00Z"),
        o("cvelist", "exploited", "2026-03-01T00:00:00Z"),
      ],
    );
    expect(c.exploitCode).toBeUndefined();
    expect(c.firstReport).toBeUndefined();
    expect(c.daysToFirstReport).toBeUndefined();
  });

  it("uses the SSVC timestamp when a Vulnrichment observation carries one", () => {
    const c = computeClock(
      [{ cveId: "CVE-2026-5", publishedAt: "2026-03-01" }],
      [o("cvelist", "exploited", "2026-03-01T00:00:00Z", { metadata: { reportedAt: "2026-03-09T14:00:00Z" }, sourceName: "CVE List" })],
    );
    expect(c.firstReport).toMatchObject({ date: "2026-03-09", label: "CVE List" });
    expect(c.daysToFirstReport).toBe(8);
  });

  it("ignores claimed observations when picking the first report", () => {
    const c = computeClock([{ cveId: "CVE-2026-3", publishedAt: "2026-02-01" }], [o("ransomware-live", "damage", "2026-02-02", { strength: "claimed" })]);
    expect(c.firstReport).toBeUndefined();
  });
});

describe("sourceCounts", () => {
  it("counts distinct sources per rung, with exploitation sources also counting for attempts", () => {
    const counts = sourceCounts([
      { kind: "attempts", strength: "reported", sourceId: "honeypot" },
      { kind: "exploited", strength: "confirmed", sourceId: "cisa-kev" },
      { kind: "exploited", strength: "reported", sourceId: "circl-sightings" },
      { kind: "exploited", strength: "reported", sourceId: "circl-sightings" },
      { kind: "talk", strength: "reported", sourceId: "feeds" },
      { kind: "advisory", strength: "confirmed", sourceId: "cisa-advisories" },
      { kind: "damage", strength: "claimed", sourceId: "ransomware-live" },
    ]);
    expect(counts).toEqual({ talk: 2, exposure: 0, attempts: 3, exploited: 2, damage: 0 });
  });
});
