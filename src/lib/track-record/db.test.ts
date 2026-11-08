import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/ingest/testdb";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { buildTrackRecord, loadCveHistories, scoreLive, versionRows } from "./index";

const L = { talk: "confirmed", exposure: "none", attempts: "none", exploited: "none", damage: "none" };
const at = (day: string) => new Date(`${day}T12:00:00Z`);
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

async function ev(id: string, hidden = false) {
  await db.insert(schema.events).values({ id, title: `Title ${id}`, ladder: L, verdict: "act_now", rulesVersion: "v2", hidden });
}
async function hist(eventId: string, verdict: string, day: string, actor = "rules") {
  await db.insert(schema.verdictHistory).values({ eventId, verdict, ladder: L, rulesVersion: "v2", reason: "r", actor, changedAt: at(day) });
}

describe("loadCveHistories", () => {
  it("keeps an adopted early event's call on the record and links the visible KEV event", async () => {
    // The early event made the call, then a KEV listing moved the CVE to a KEV event and hid it.
    await ev("early-cve-2026-0001", true);
    await hist("early-cve-2026-0001", "act_now", "2026-10-24");
    await ev("kev-2026-10-28-acme");
    await db.insert(schema.eventCves).values({ eventId: "kev-2026-10-28-acme", cveId: "CVE-2026-0001" });
    await hist("kev-2026-10-28-acme", "act_now", "2026-10-28");
    await db.insert(schema.vulnerabilities).values({ cveId: "CVE-2026-0001", kevCisaDateAdded: "2026-10-28", kevVulncheckDateAdded: "2026-10-27" });
    // An admin override is not the rules' call.
    await ev("early-cve-2026-0002");
    await hist("early-cve-2026-0002", "act_now", "2026-10-25", "admin:jess");
    await hist("early-cve-2026-0002", "watch", "2026-10-24");

    const { cves, events, visibleOwner } = await loadCveHistories(db);
    const one = cves.find((c) => c.cveId === "CVE-2026-0001")!;
    expect(one.kevDate).toBe("2026-10-27");
    expect(one.rows.map((r) => r.eventId).sort()).toEqual(["early-cve-2026-0001", "kev-2026-10-28-acme"]);
    expect(cves.find((c) => c.cveId === "CVE-2026-0002")!.rows.map((r) => r.verdict)).toEqual(["watch"]);

    const rec = buildTrackRecord(scoreLive(cves, at("2026-11-08")), events, visibleOwner, {});
    expect(rec.live.actNow.overall).toMatchObject({ calls: 1, right: 1, medianLeadDays: 3 });
    expect(rec.live.actNow.calls[0]).toMatchObject({ eventId: "early-cve-2026-0001", title: "Title kev-2026-10-28-acme", url: expect.stringContaining("/events/kev-2026-10-28-acme") });
  });
});

describe("versionRows", () => {
  it("lists every version newest first and gives a version that keeps another's verdicts that version's report", () => {
    const report = {
      file: "v2.json",
      rulesVersion: "v2",
      ranAt: "2026-10-24",
      window: { from: "2025-04-01", to: "2026-10-01", split: "2026-04-01" },
      dataset: { builtAt: "", cves: 1 },
      scorecards: [
        { period: { name: "all", from: "2025-04-01", to: "2026-10-01" }, actNow: { preConfirmation: { n: 10, hits: 4, rate: 0.4, ci: [0.1, 0.7] } }, leadTime: { shareBeforeKev: { n: 20, hits: 3, rate: 0.15 }, medianPreKev: 4 } },
        { period: { name: "held-out", from: "2026-04-01", to: "2026-10-01" }, actNow: { preConfirmation: { n: 5, hits: 1, rate: 0.2 } }, leadTime: { shareBeforeKev: { n: 0, hits: 0 } } },
      ],
    } as never;
    const rows = versionRows({ v2: report });
    expect(rows.map((r) => r.version)).toEqual(["v3", "v2", "v1", "v0"]);
    expect(rows[0]).toMatchObject({ active: true, verdictsFrom: "v2", backtest: { reportVersion: "v2", medianLeadDays: 4 } });
    expect(rows[0].backtest?.actNowAll).toMatchObject({ rate: 0.4, hits: 4, n: 10 });
    expect(rows[0].backtest?.actNowHeldOut).toMatchObject({ rate: 0.2 });
    expect(rows[3].backtest).toBeNull();
  });
});
