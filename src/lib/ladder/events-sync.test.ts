import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { eventCves, events, observations, verdictHistory } from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { insertObservations, loadTrackedCves, seedSources, upsertVulnerabilities } from "@/lib/ingest/runner";
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

describe("early (pre-listing) events", () => {
  const day = 86400000;
  const ago = (d: number) => new Date(now.getTime() - d * day).toISOString();
  const report = (cve: string, label: string, daysAgo = 2): ObservationInput => ({
    sourceId: "circl-sightings",
    dedupeKey: `circl:${cve}:${label}`,
    kind: "exploited",
    strength: "reported",
    cveIds: [cve],
    title: `Exploitation of ${cve} reported`,
    url: "https://x",
    publishedAt: ago(daysAgo),
    metadata: { sourceLabel: label },
  });
  const honeypot = (cve: string): ObservationInput => ({
    sourceId: "circl-sightings",
    dedupeKey: `circl:${cve}:honeypot`,
    kind: "attempts",
    strength: "confirmed",
    cveIds: [cve],
    title: "Attempts",
    url: "https://x",
    publishedAt: ago(1),
  });
  async function seedEarly(cve: string, reports: string[], opts: { age?: number; vendor?: string; product?: string; published?: boolean } = {}) {
    await upsertVulnerabilities(db, [
      { cveId: cve, vendor: opts.vendor ?? "Acme", product: opts.product ?? "Gateway", title: `${cve} title`, publishedAt: opts.published === false ? undefined : ago(opts.age ?? 10) },
    ]);
    await insertObservations(db, undefined, reports.map((r) => report(cve, r)));
  }
  const live = async () => (await db.select().from(events)).filter((e) => !e.hidden);

  it("creates an Act now event from two separate reports, with a stable id and first history row", async () => {
    await seedEarly("CVE-2026-5001", ["telegram", "news"]);
    const s = await syncEvents(db, { now });
    expect(s).toMatchObject({ created: 1, earlyCandidates: 1, earlyDeferred: 0, earlySkippedNoAge: 0 });
    const [e] = await db.select().from(events);
    expect(e).toMatchObject({ id: "early-cve-2026-5001", verdict: "act_now", kind: "vulnerability", hidden: false });
    expect(e.ladder).toMatchObject({ exploited: "reported", attempts: "reported" });
    expect((await db.select().from(eventCves)).map((r) => [r.eventId, r.cveId])).toEqual([["early-cve-2026-5001", "CVE-2026-5001"]]);
    expect((await db.select().from(observations)).every((o) => o.eventId === "early-cve-2026-5001")).toBe(true);
    expect(await db.select().from(verdictHistory)).toHaveLength(1);
  });

  it("holds a single report at Watch and lifts it when honeypots see attempts", async () => {
    await seedEarly("CVE-2026-5002", ["telegram"]);
    await syncEvents(db, { now });
    expect((await live())[0].verdict).toBe("watch");
    await insertObservations(db, undefined, [honeypot("CVE-2026-5002")]);
    await syncEvents(db, { now });
    expect((await live())[0].verdict).toBe("act_now");
    const hist = await db.select().from(verdictHistory).orderBy(verdictHistory.id);
    expect(hist.map((h) => h.verdict)).toEqual(["watch", "act_now"]);
  });

  it("is idempotent", async () => {
    await seedEarly("CVE-2026-5001", ["telegram", "news"]);
    await syncEvents(db, { now });
    const s = await syncEvents(db, { now });
    expect(s).toMatchObject({ created: 0, updated: 0, unchanged: 1, verdictChanges: 0 });
    expect(await db.select().from(verdictHistory)).toHaveLength(1);
  });

  it("skips CVEs already in KEV, CVEs with stale evidence and CVEs with no known publish date", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await insertObservations(db, undefined, [report("CVE-2026-1001", "telegram"), report("CVE-2026-1001", "news")]);
    await seedEarly("CVE-2026-5003", ["telegram"], { published: false });
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-5004", publishedAt: ago(100) }]);
    await insertObservations(db, undefined, [report("CVE-2026-5004", "telegram", 45)]);
    const s = await syncEvents(db, { now });
    expect(s.earlySkippedNoAge).toBe(1);
    expect(s.earlyCandidates).toBe(1);
    expect((await db.select().from(events)).map((e) => e.id)).toEqual(["kev-2026-10-20-plex-media-server"]);
  });

  it("caps new early events per run, strongest evidence first, and picks up the rest next run", async () => {
    await seedEarly("CVE-2026-5101", ["telegram"]);
    await seedEarly("CVE-2026-5102", ["telegram", "news"]);
    await seedEarly("CVE-2026-5103", ["telegram", "news", "blog"]);
    await seedEarly("CVE-2026-5104", ["telegram"]);
    const s1 = await syncEvents(db, { now, maxNewEarly: 2 });
    expect(s1).toMatchObject({ created: 2, earlyCandidates: 4, earlyDeferred: 2 });
    expect((await db.select().from(events)).map((e) => e.id).sort()).toEqual(["early-cve-2026-5102", "early-cve-2026-5103"]);
    const s2 = await syncEvents(db, { now, maxNewEarly: 2 });
    expect(s2).toMatchObject({ created: 2, earlyDeferred: 0, unchanged: 2 });
    expect(await db.select().from(events)).toHaveLength(4);
  });

  it("keeps the early event id when the CVE is later listed in KEV, and the history continues", async () => {
    await seedEarly("CVE-2026-5001", ["telegram", "news"], { vendor: "Plex", product: "Media Server" });
    await syncEvents(db, { now });
    const [before] = await db.select().from(events);
    // CISA lists it.
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-5001", kevCisaDateAdded: "2026-10-23" }]);
    await insertObservations(db, undefined, [kevObs("CVE-2026-5001")]);
    const s = await syncEvents(db, { now });
    expect(s.created).toBe(0);
    const evs = await db.select().from(events);
    expect(evs.map((e) => e.id)).toEqual(["early-cve-2026-5001"]);
    expect(evs[0].hidden).toBe(false);
    expect(evs[0].firstSeenAt).toEqual(before.firstSeenAt);
    expect(evs[0].ladder).toMatchObject({ exploited: "confirmed" });
    const hist = await db.select().from(verdictHistory).orderBy(verdictHistory.id);
    expect(hist).toHaveLength(2);
    expect(hist[0].ladder).toMatchObject({ exploited: "reported" });
    expect(hist[1].ladder).toMatchObject({ exploited: "confirmed" });
    // Idempotent after the listing.
    expect(await syncEvents(db, { now })).toMatchObject({ created: 0, updated: 0, verdictChanges: 0 });
  });

  it("merges several early events into the earliest one when a KEV cluster takes them in", async () => {
    await seedEarly("CVE-2026-5201", ["telegram", "news"], { vendor: "Plex", product: "Media Server" });
    await syncEvents(db, { now: new Date(now.getTime() - 2 * day) });
    await seedEarly("CVE-2026-5202", ["telegram", "news"], { vendor: "Plex", product: "Media Server" });
    await syncEvents(db, { now });
    expect((await live()).map((e) => e.id).sort()).toEqual(["early-cve-2026-5201", "early-cve-2026-5202"]);
    await upsertVulnerabilities(db, [
      { cveId: "CVE-2026-5201", kevCisaDateAdded: "2026-10-23" },
      { cveId: "CVE-2026-5202", kevCisaDateAdded: "2026-10-23" },
    ]);
    await insertObservations(db, undefined, [kevObs("CVE-2026-5201"), kevObs("CVE-2026-5202")]);
    const s = await syncEvents(db, { now });
    expect(s.eventsHidden).toBe(1);
    const survivors = await live();
    expect(survivors.map((e) => e.id)).toEqual(["early-cve-2026-5201"]);
    const links = await db.select().from(eventCves);
    expect(links.filter((l) => l.eventId === "early-cve-2026-5201").map((l) => l.cveId).sort()).toEqual(["CVE-2026-5201", "CVE-2026-5202"]);
    expect(links.filter((l) => l.eventId === "early-cve-2026-5202")).toHaveLength(0);
    const closing = (await db.select().from(verdictHistory).where(eq(verdictHistory.eventId, "early-cve-2026-5202"))).at(-1)!;
    expect(closing.reason).toContain("Merged into early-cve-2026-5201");
    const obs = await db.select().from(observations);
    expect(obs.every((o) => o.eventId === "early-cve-2026-5201")).toBe(true);
  });

  it("adds early CVEs to the tracked list for enrichment, undated ones first", async () => {
    await seedKev("CVE-2026-1001", "2026-10-20");
    await seedEarly("CVE-2026-5301", ["telegram"], { published: false });
    await seedEarly("CVE-2026-5302", ["telegram"]);
    expect(await loadTrackedCves(db, 2000, now)).toEqual(["CVE-2026-5301", "CVE-2026-1001", "CVE-2026-5302"]);
  });
});
