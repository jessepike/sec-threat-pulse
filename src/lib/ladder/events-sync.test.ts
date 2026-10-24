import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { eventCves, events, observations, verdictHistory } from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { insertObservations, seedSources, upsertVulnerabilities } from "@/lib/ingest/runner";
import { createTestDb } from "@/lib/ingest/testdb";
import { syncEvents } from "./events-sync";
import { CURRENT_RULES_VERSION } from "./rules";
import type { ObservationInput } from "./types";

const now = new Date("2026-10-24T12:00:00Z");
let db: Db;

const kevObs = (cve: string, vendor = "Plex", product = "Media Server"): ObservationInput => ({ sourceId: "cisa-kev", dedupeKey: `cisa-kev:${cve}`, kind: "exploited", strength: "confirmed", cveIds: [cve], vendor, product, title: cve, url: "https://x" });
const msf = (cve: string): ObservationInput => ({ sourceId: "metasploit", dedupeKey: `metasploit:${cve}`, kind: "exploit_available", strength: "confirmed", cveIds: [cve], title: "m", url: "https://x", metadata: { maturity: "weaponized" } });

async function seedKev(cve: string, date: string, vendor = "Plex", product = "Media Server") {
  await upsertVulnerabilities(db, [{ cveId: cve, vendor, product, title: `${vendor} ${cve}`, kevCisaDateAdded: date }]);
  await insertObservations(db, undefined, [kevObs(cve, vendor, product)]);
}

beforeEach(async () => {
  db = await createTestDb();
  await seedSources(db);
});

describe("syncEvents", () => {
  it("creates events, links CVEs and observations, and writes the first history row", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await seedKev("CVE-2026-1002", "2026-10-22");
    await seedKev("CVE-2026-2001", "2026-10-21", "Cisco", "ASA");
    const s = await syncEvents(db, { now });
    expect(s).toMatchObject({ considered: 2, created: 2, updated: 0, verdictChanges: 2 });
    const evs = await db.select().from(events);
    expect(evs.map((e) => e.id).sort()).toEqual(["kev-2026-10-20-plex-media-server", "kev-2026-10-21-cisco-asa"]);
    const plex = evs.find((e) => e.vendor === "Plex")!;
    expect(plex).toMatchObject({ kind: "vulnerability", rulesVersion: CURRENT_RULES_VERSION, verdict: "watch", hidden: false });
    expect(plex.ladder).toMatchObject({ exploited: "confirmed", damage: "none" });
    const cisco = evs.find((e) => e.vendor === "Cisco")!;
    expect(cisco.verdict).toBe("act_now");
    expect((await db.select().from(eventCves).where(eq(eventCves.eventId, plex.id))).map((r) => r.cveId).sort()).toEqual(["CVE-2026-1001", "CVE-2026-1002"]);
    const obs = await db.select().from(observations);
    expect(obs.every((o) => o.eventId !== null)).toBe(true);
    expect(obs.find((o) => o.dedupeKey === "cisa-kev:CVE-2026-2001")!.eventId).toBe(cisco.id);
    expect(await db.select().from(verdictHistory)).toHaveLength(2);
  });

  it("is idempotent: a second run changes nothing and adds no history", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await syncEvents(db, { now });
    const before = (await db.select().from(events))[0].updatedAt;
    const s = await syncEvents(db, { now: new Date(now.getTime() + 60000) });
    expect(s).toMatchObject({ created: 0, updated: 0, unchanged: 1, verdictChanges: 0, observationsAttached: 0 });
    expect(await db.select().from(verdictHistory)).toHaveLength(1);
    expect((await db.select().from(events))[0].updatedAt).toEqual(before);
  });

  it("writes history when a ladder or verdict changes, and keeps the event id", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await syncEvents(db, { now });
    await insertObservations(db, undefined, [msf("CVE-2026-1001")]);
    const s = await syncEvents(db, { now });
    expect(s).toMatchObject({ updated: 1, verdictChanges: 1 });
    const [e] = await db.select().from(events);
    expect(e).toMatchObject({ id: "kev-2026-10-20-plex-media-server", verdict: "act_now", exploitMaturity: "weaponized" });
    const hist = await db.select().from(verdictHistory).orderBy(verdictHistory.id);
    expect(hist.map((h) => h.verdict)).toEqual(["watch", "act_now"]);
    expect(hist[1].actor).toBe("rules");
  });

  it("does not write history for a change that leaves verdict and ladder alone", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await syncEvents(db, { now });
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-1001", exploitMaturity: "poc" }]);
    const s = await syncEvents(db, { now });
    expect(s).toMatchObject({ updated: 1, verdictChanges: 0 });
    expect(await db.select().from(verdictHistory)).toHaveLength(1);
  });

  it("adds a late CVE to the existing event", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await syncEvents(db, { now });
    await seedKev("CVE-2026-1002", "2026-10-23");
    await syncEvents(db, { now });
    expect(await db.select().from(events)).toHaveLength(1);
    expect(await db.select().from(eventCves)).toHaveLength(2);
    const [e] = await db.select().from(events);
    expect(e.title).toBe("Plex Media Server: 2 vulnerabilities exploited");
  });

  it("merges two clusters when a bridging CVE arrives and hides the superseded event", async () => {
    await seedKev("CVE-2026-1001", "2026-10-01");
    await seedKev("CVE-2026-1003", "2026-10-07");
    await syncEvents(db, { now });
    expect(await db.select().from(events)).toHaveLength(2);
    await seedKev("CVE-2026-1002", "2026-10-04");
    const s = await syncEvents(db, { now });
    expect(s.created).toBe(0);
    const evs = await db.select().from(events);
    const live = evs.filter((e) => !e.hidden);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe("kev-2026-10-01-plex-media-server");
    const links = await db.select().from(eventCves);
    expect(links.filter((l) => l.eventId === live[0].id)).toHaveLength(3);
    expect(links.filter((l) => l.eventId !== live[0].id)).toHaveLength(0);
  });

  it("ignores events outside the lookback and leaves admin events and overrides alone", async () => {
    await seedKev("CVE-2025-1", "2025-01-01");
    await seedKev("CVE-2026-1001", "2026-10-20");
    await db.insert(events).values({ id: "php2shell", title: "Admin event", ladder: {}, rulesVersion: "v0" });
    await syncEvents(db, { now });
    await db.update(events).set({ overrideVerdict: "act_now", overrideReason: "Owner call" }).where(eq(events.id, "kev-2026-10-20-plex-media-server"));
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-1001", epss: 0.9 }]);
    await syncEvents(db, { now });
    const evs = await db.select().from(events);
    expect(evs.map((e) => e.id).sort()).toEqual(["kev-2026-10-20-plex-media-server", "php2shell"]);
    expect(evs.find((e) => e.id === "php2shell")!.title).toBe("Admin event");
    const auto = evs.find((e) => e.id !== "php2shell")!;
    expect(auto).toMatchObject({ overrideVerdict: "act_now", overrideReason: "Owner call", verdict: "act_now" });
  });

  it("keeps observations the admin assigned to another event", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await db.insert(events).values({ id: "php2shell", title: "Admin event", ladder: {}, rulesVersion: "v0" });
    await db.update(observations).set({ eventId: "php2shell" });
    await syncEvents(db, { now });
    expect((await db.select().from(observations))[0].eventId).toBe("php2shell");
  });

  it("returns an empty summary with no KEV data", async () => {
    expect(await syncEvents(db, { now })).toMatchObject({ considered: 0, created: 0 });
  });
});
