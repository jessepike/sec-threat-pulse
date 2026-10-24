import { beforeEach, describe, expect, it } from "vitest";
import { corrections, events, eventCves, sourceRuns } from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { insertObservations, seedSources, upsertVulnerabilities } from "@/lib/ingest/runner";
import { createTestDb } from "@/lib/ingest/testdb";
import { fmtCell, headlineRows, latestReports, revealLog } from "../backtest";
import { freshness, kevCoverage, trust } from "../scorecard";

const now = new Date("2026-10-24T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86400000);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await seedSources(db);
});

describe("scorecard queries", () => {
  it("counts successful runs per day over the window and finds the newest observation", async () => {
    await db.insert(sourceRuns).values([
      { sourceId: "cisa-kev", startedAt: ago(1), status: "ok" },
      { sourceId: "cisa-kev", startedAt: ago(2), status: "ok" },
      { sourceId: "cisa-kev", startedAt: ago(3), status: "error" },
      { sourceId: "cisa-kev", startedAt: ago(20), status: "ok" },
      { sourceId: "epss", startedAt: ago(1), status: "ok" },
    ]);
    await insertObservations(db, undefined, [
      { sourceId: "cisa-kev", dedupeKey: "k1", kind: "exploited", strength: "confirmed", cveIds: ["CVE-2026-1"], title: "t", url: "https://x" },
    ]);
    const f = await freshness(db, now, 7);
    const kev = f.rows.find((r) => r.sourceId === "cisa-kev")!;
    expect(kev).toMatchObject({ okRuns: 2, errorRuns: 1 });
    expect(kev.runsPerDay).toBeCloseTo(2 / 7);
    expect(kev.newestObservationAt).toBeInstanceOf(Date);
    expect(f.rows.find((r) => r.sourceId === "epss")!.newestObservationAt).toBeNull();
    expect(f.pipelineRunsPerDay).toBeCloseTo(3 / 7);
  });

  it("measures how many KEV additions in the last 30 days have a visible event", async () => {
    await upsertVulnerabilities(db, [
      { cveId: "CVE-2026-1", kevCisaDateAdded: "2026-10-20" },
      { cveId: "CVE-2026-2", kevCisaDateAdded: "2026-10-21" },
      { cveId: "CVE-2026-3", kevVulncheckDateAdded: "2026-10-22T00:00:00Z" },
      { cveId: "CVE-2025-9", kevCisaDateAdded: "2025-01-01" },
    ]);
    await db.insert(events).values([
      { id: "e1", title: "a", ladder: {}, rulesVersion: "v2" },
      { id: "e2", title: "b", ladder: {}, rulesVersion: "v2", hidden: true },
    ]);
    await db.insert(eventCves).values([
      { eventId: "e1", cveId: "CVE-2026-1" },
      { eventId: "e2", cveId: "CVE-2026-2" },
    ]);
    expect(await kevCoverage(db, now, 30)).toEqual({ kevAdditions: 3, withEvent: 1 });
  });

  it("counts observations with a source link and the corrections log", async () => {
    await insertObservations(db, undefined, [
      { sourceId: "cisa-kev", dedupeKey: "a", kind: "exploited", strength: "confirmed", cveIds: [], title: "t", url: "https://x" },
      { sourceId: "cisa-kev", dedupeKey: "b", kind: "exploited", strength: "confirmed", cveIds: [], title: "t", url: "" },
    ]);
    await db.insert(corrections).values([
      { text: "old fix", actor: "a", createdAt: ago(60) },
      { text: "recent fix", actor: "a", createdAt: ago(2) },
    ]);
    expect(await trust(db, now)).toEqual({ observations: 2, withUrl: 1, correctionsTotal: 2, corrections30d: 1 });
  });
});

describe("backtest reports", () => {
  it("loads the latest report per rules version with the headline figures from the files", async () => {
    const reports = await latestReports();
    expect(Object.keys(reports).sort()).toEqual(["v0", "v1", "v2"]);
    const rows = headlineRows(reports.v2);
    expect(rows[0].cells.all).toBe("43.4% (35 to 53); 49/113");
    expect(rows[0].cells["held-out"]).toBe("35.5% (21 to 53); 11/31");
  });

  it("reads the held out reveal log", async () => {
    const log = await revealLog();
    expect(log?.length).toBeGreaterThan(0);
    expect(log![0]).toMatchObject({ rules: "v2", purpose: "run" });
  });

  it("formats an empty cell", () => {
    expect(fmtCell({ n: 0, hits: 0 })).toBe("n/a");
  });
});
