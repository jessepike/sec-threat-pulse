import { describe, expect, it } from "vitest";
import type { AdapterContext } from "@/lib/ladder/types";
import { fakeFetch, fixture, noSleep } from "./testing";
import { CISA_ICS_MAX_DOCS, cisaIcsAdapter, parseChanges, parseCsafAdvisory } from "./adapters/cisa-ics";

const now = new Date("2026-11-16T18:00:00Z");
const ctx = (f: typeof fetch, extra: Partial<AdapterContext> = {}): AdapterContext => ({ fetch: f, now, sleep: noSleep, ...extra });

const docs = ["icsa-26-316-05", "icsa-26-307-01", "icsa-26-295-11", "icsma-26-295-01"];
const routes = (changes = fixture("cisa-ics/changes.csv")) =>
  fakeFetch([
    ["/changes.csv", { body: changes, headers: { etag: '"v1"' } }],
    ...docs.map((d) => [`/2026/${d}.json`, fixture(`cisa-ics/${d}.json`)] as [string, string]),
  ]);

describe("cisa-ics", () => {
  it("reads advisories changed in the last 30 days and turns each into one advisory observation per CVE", async () => {
    const ff = routes();
    const r = await cisaIcsAdapter.run(ctx(ff.fetch));
    expect(ff.calls[0].url).toBe("https://raw.githubusercontent.com/cisagov/CSAF/develop/csaf_files/OT/white/changes.csv");
    // The July document is outside the window and is never fetched.
    expect(ff.calls.map((c) => c.url.split("/").pop())).toEqual(["changes.csv", ...docs.map((d) => `${d}.json`)]);
    expect(r.observations.map((o) => o.dedupeKey)).toEqual([
      "cisa-ics:ICSA-26-316-05:CVE-2026-109618",
      "cisa-ics:ICSA-26-316-05:CVE-2026-109619",
      "cisa-ics:ICSA-26-307-01:CVE-2026-63017",
      "cisa-ics:ICSA-26-307-01:CVE-2026-63774",
      "cisa-ics:ICSMA-26-295-01:CVE-2026-111594",
    ]);
    expect(r.observations[2]).toMatchObject({
      sourceId: "cisa-ics",
      kind: "advisory",
      strength: "reported",
      cveIds: ["CVE-2026-63017"],
      vendor: "Subnet Solutions",
      url: "https://www.cisa.gov/news-events/ics-advisories/icsa-26-307-01",
      publishedAt: "2026-11-03T06:00:00.000Z",
    });
    expect(r.observations[3].cveIds).toEqual(["CVE-2026-63774"]);
    expect(r.observations[2].title).toMatch(/^CISA ICS advisory ICSA-26-307-01: /);
    expect(r.observations[4].url).toBe("https://www.cisa.gov/news-events/ics-medical-advisories/icsma-26-295-01");
    // A republished vendor advisory links to CISA's page, not the vendor's.
    expect(r.observations[0].url).toBe("https://www.cisa.gov/news-events/ics-advisories/icsa-26-316-05");
    expect(r.vulnerabilities).toEqual([]);
    expect(r.stats).toMatchObject({ documents: 4, withCve: 3, rollup: 1, waiting: 0, failed: 0 });
    expect(JSON.parse(r.cursor!)).toMatchObject({ e: '"v1"', seen: { "2026/icsa-26-295-11.json": "2026-10-22T06:00:00.000000Z" } });
  });

  it("is idempotent: a second run with the cursor fetches no documents", async () => {
    const first = await cisaIcsAdapter.run(ctx(routes().fetch));
    const ff = routes();
    const r = await cisaIcsAdapter.run(ctx(ff.fetch, { cursor: first.cursor }));
    expect(ff.calls).toHaveLength(1);
    expect(r.observations).toEqual([]);
  });

  it("rereads a document whose change time moved", async () => {
    const first = await cisaIcsAdapter.run(ctx(routes().fetch));
    const moved = fixture("cisa-ics/changes.csv").replace('"2026/icsa-26-307-01.json","2026-11-03T07:00:00.000000Z"', '"2026/icsa-26-307-01.json","2026-11-14T07:00:00.000000Z"');
    const ff = routes(moved);
    const r = await cisaIcsAdapter.run(ctx(ff.fetch, { cursor: first.cursor }));
    expect(ff.calls.map((c) => c.url.split("/").pop())).toEqual(["changes.csv", "icsa-26-307-01.json"]);
    expect(r.observations.map((o) => o.dedupeKey)).toEqual(["cisa-ics:ICSA-26-307-01:CVE-2026-63017", "cisa-ics:ICSA-26-307-01:CVE-2026-63774"]);
  });

  it("gives a CVE added by a revision its own key, so the runner stores its evidence", () => {
    const doc = JSON.parse(fixture("cisa-ics/icsa-26-307-01.json"));
    const before = parseCsafAdvisory(doc, "2026/icsa-26-307-01.json");
    doc.vulnerabilities.push({ cve: "CVE-2026-70001" });
    const after = parseCsafAdvisory(doc, "2026/icsa-26-307-01.json");
    const keys = (p: typeof before) => ("observations" in p ? p.observations.map((o) => o.dedupeKey) : []);
    expect(keys(after).filter((k) => !keys(before).includes(k))).toEqual(["cisa-ics:ICSA-26-307-01:CVE-2026-70001"]);
  });

  it("keeps the good documents when one fails, and retries the failed one next run without the ETag", async () => {
    const ff = fakeFetch([
      ["/changes.csv", { body: fixture("cisa-ics/changes.csv"), headers: { etag: '"v1"' } }],
      ["/2026/icsa-26-307-01.json", "{not json"],
      ...docs.filter((d) => d !== "icsa-26-307-01").map((d) => [`/2026/${d}.json`, fixture(`cisa-ics/${d}.json`)] as [string, string]),
    ]);
    const r = await cisaIcsAdapter.run(ctx(ff.fetch));
    expect(r.stats).toMatchObject({ failed: 1, withCve: 2 });
    expect(r.observations.map((o) => o.dedupeKey).some((k) => k.includes("ICSA-26-307-01"))).toBe(false);
    const cur = JSON.parse(r.cursor!);
    expect(cur.e).toBeUndefined();
    expect(cur.seen["2026/icsa-26-307-01.json"]).toBeUndefined();
    const again = routes();
    const r2 = await cisaIcsAdapter.run(ctx(again.fetch, { cursor: r.cursor }));
    expect(again.calls.map((c) => c.url.split("/").pop())).toEqual(["changes.csv", "icsa-26-307-01.json"]);
    expect(r2.observations).toHaveLength(2);
  });

  it("marks a removed document as read, and fails the run only when every document fails", async () => {
    const gone = fakeFetch([
      ["/changes.csv", fixture("cisa-ics/changes.csv")],
      ["/2026/icsa-26-316-05.json", { status: 404, body: "404: Not Found" }],
      ...docs.filter((d) => d !== "icsa-26-316-05").map((d) => [`/2026/${d}.json`, fixture(`cisa-ics/${d}.json`)] as [string, string]),
    ]);
    const r = await cisaIcsAdapter.run(ctx(gone.fetch));
    expect(r.stats).toMatchObject({ gone: 1, failed: 0 });
    expect(JSON.parse(r.cursor!).seen["2026/icsa-26-316-05.json"]).toBeDefined();
    const down = fakeFetch([
      ["/changes.csv", fixture("cisa-ics/changes.csv")],
      [/\/2026\//, { status: 403, body: "forbidden" }],
    ]);
    await expect(cisaIcsAdapter.run(ctx(down.fetch))).rejects.toThrow(/every document fetch failed/);
  });

  it("caps documents per run and leaves the rest, without the ETag, for the next run", async () => {
    const rows = Array.from({ length: CISA_ICS_MAX_DOCS + 3 }, (_, i) => `"2026/icsa-26-316-${String(i + 10).padStart(2, "0")}.json","2026-11-12T07:00:00Z"`).join("\n");
    const ff = fakeFetch([
      ["/changes.csv", { body: rows, headers: { etag: '"v2"' } }],
      [/\/2026\/icsa-26-316-\d+\.json$/, fixture("cisa-ics/icsa-26-307-01.json")],
    ]);
    const r = await cisaIcsAdapter.run(ctx(ff.fetch));
    expect(ff.calls).toHaveLength(1 + CISA_ICS_MAX_DOCS);
    expect(r.stats).toMatchObject({ waiting: 3 });
    const cur = JSON.parse(r.cursor!);
    expect(cur.e).toBeUndefined();
    expect(Object.keys(cur.seen)).toHaveLength(CISA_ICS_MAX_DOCS);
  });

  it("parses rows and documents defensively", async () => {
    expect(parseChanges('"2026/a.json","2026-11-01T00:00:00Z"\n"../x","2026-11-02T00:00:00Z"\n"2026/b.json","nope"\n"2026/c.json","2026-11-03T00:00:00Z"')).toEqual([
      { path: "2026/c.json", changedAt: "2026-11-03T00:00:00Z" },
      { path: "2026/a.json", changedAt: "2026-11-01T00:00:00Z" },
    ]);
    expect(parseCsafAdvisory({ document: { tracking: { id: "ICSA-1" } }, vulnerabilities: [{}] }, "2026/x.json")).toEqual({ skip: "no-cve", cves: 0 });
    expect(parseCsafAdvisory({ vulnerabilities: [{ cve: "CVE-2026-1234" }] }, "2026/x.json")).toEqual({ skip: "no-id", cves: 1 });
    await expect(cisaIcsAdapter.run(ctx(fakeFetch([["/changes.csv", "<html>rate limited</html>"]]).fetch))).rejects.toThrow(/no rows/);
  });
});
