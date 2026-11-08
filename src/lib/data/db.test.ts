import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/ingest/testdb";
import * as schema from "@/lib/db/schema";

let current: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/lib/db/client", async () => ({ getDb: () => current, schema: await import("@/lib/db/schema") }));

const { dbBriefEvents, dbCorrections, dbEvent, dbEventsPage, dbHomeEvents } = await import("./db");

const LADDER = { talk: "confirmed", exposure: "none", attempts: "none", exploited: "none", damage: "none" };
// Fixtures are dated in October 2026. The home page keeps Act now events with evidence from the
// last 30 days, so the clock is pinned to Oct 10, 2026 or the test would expire in November.
const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12));
const NOW = Date.UTC(2026, 9, 10, 12);
let seq = 0;

async function ev(id: string, verdict: string, over: Partial<typeof schema.events.$inferInsert> = {}) {
  await current.insert(schema.events).values({ id, title: `Title ${id}`, ladder: LADDER, verdict, rulesVersion: "v2", ...over });
}
async function obs(eventId: string, kind: string, at: Date) {
  seq += 1;
  await current.insert(schema.observations).values({ sourceId: "s1", dedupeKey: `k${seq}`, kind, strength: "reported", eventId, title: `Obs ${seq}`, url: `https://example.com/${seq}`, publishedAt: at });
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  current = await createTestDb();
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(async () => {
  current = await createTestDb();
  await current.insert(schema.sources).values({ id: "s1", name: "Source", category: "x", homepage: "https://example.com" });
});

describe("live event lists", () => {
  it("orders by verdict, then newest evidence, and hides hidden events", async () => {
    await ev("w-old", "watch");
    await obs("w-old", "talk", day(1));
    await ev("w-new", "watch");
    await obs("w-new", "talk", day(5));
    await ev("act", "act_now");
    await obs("act", "talk", day(2));
    await ev("gone", "act_now", { hidden: true });
    await ev("over", "low", { overrideVerdict: "act_now", overrideReason: "x" });
    await obs("over", "talk", day(9));
    const { counts, items } = await dbHomeEvents();
    expect(items.map((x) => x.row.id)).toEqual(["over", "act", "w-new", "w-old"]);
    expect(counts).toEqual({ act_now: 2, watch: 2, low: 0, total: 4 });
  });

  it("keeps early Watch events with one report off the home page but on /events", async () => {
    await ev("early-cve-1", "watch");
    await obs("early-cve-1", "attempts", day(3));
    await ev("early-cve-2", "watch");
    await obs("early-cve-2", "attempts", day(3));
    await obs("early-cve-2", "talk", day(4));
    await ev("early-cve-3", "act_now");
    await obs("early-cve-3", "attempts", day(3));
    const home = await dbHomeEvents();
    expect(home.items.map((x) => x.row.id).sort()).toEqual(["early-cve-2", "early-cve-3"]);
    expect(home.counts.total).toBe(3);
    const page = await dbEventsPage("all", 1);
    expect(page.rows.map((r) => r.id).sort()).toEqual(["early-cve-1", "early-cve-2", "early-cve-3"]);
    expect((await dbEventsPage("watch", 1)).total).toBe(2);
  });

  it("caps Watch at 12 and Low at 6 on home, and pages /events 50 at a time", async () => {
    for (let i = 0; i < 60; i++) await ev(`w${String(i).padStart(2, "0")}`, "watch");
    for (let i = 0; i < 10; i++) await ev(`l${i}`, "low");
    const home = await dbHomeEvents();
    expect(home.items.filter((x) => x.row.verdict === "watch")).toHaveLength(12);
    expect(home.items.filter((x) => x.row.verdict === "low")).toHaveLength(6);
    const p1 = await dbEventsPage("all", 1);
    const p2 = await dbEventsPage("all", 2);
    expect(p1.rows).toHaveLength(50);
    expect(p2.rows).toHaveLength(20);
    expect(p1.pages).toBe(2);
  });

  it("gives the brief its lead event and recent updates", async () => {
    await ev("lead", "act_now");
    await obs("lead", "talk", day(2));
    const b = await dbBriefEvents();
    expect(b.top?.row.id).toBe("lead");
    expect(b.counts.total).toBe(1);
  });
});

describe("event freshness", () => {
  it("reports the newest evidence date for each rung", async () => {
    await ev("e1", "watch", { firstSeenAt: day(1), updatedAt: day(8) });
    await obs("e1", "talk", day(2));
    await obs("e1", "talk", day(6));
    const e = await dbEvent("e1");
    expect(e?.rungs.find((r) => r.rung === "talk")?.newestAt).toBe(day(6).toISOString());
    expect(e?.rungs.find((r) => r.rung === "damage")?.newestAt).toBeUndefined();
    expect(e?.updatedAt).toBe(day(8).toISOString());
    expect(e?.trackingSince).toBe(day(1).toISOString());
  });
});

describe("corrections log", () => {
  it("lists every row newest first, links only public events and never returns the editor", async () => {
    await ev("shown", "watch");
    await ev("hid", "watch", { hidden: true });
    await current.insert(schema.corrections).values([
      { eventId: "shown", text: "first", actor: "admin:jesse", createdAt: day(1) },
      { eventId: null, text: "general", actor: "admin:jesse", createdAt: day(3) },
      { eventId: "hid", text: "hidden one", actor: "admin:jesse", createdAt: day(2) },
    ]);
    const rows = await dbCorrections();
    expect(rows.map((r) => r.text)).toEqual(["general", "hidden one", "first"]);
    expect(rows[2]).toMatchObject({ eventHref: "/events/shown", eventTitle: "Title shown" });
    expect(rows[1]).toMatchObject({ eventHref: null, eventTitle: null });
    expect(JSON.stringify(rows)).not.toContain("admin:");
  });
});

describe("kevFix", () => {
  it("restates CISA's action, the earliest due date and the ransomware flag", async () => {
    const { kevFix } = await import("./db");
    const text = kevFix([
      { sourceId: "cisa-kev", metadata: { dueDate: "2026-11-05", ransomware: "Unknown" } },
      { sourceId: "cisa-kev", metadata: { dueDate: "2026-11-03", ransomware: "Known" } },
      { sourceId: "epss", metadata: {} },
    ], new Date("2026-10-25T00:00:00Z"));
    expect(text).toContain("apply the vendor's fix");
    expect(text).toContain("CISA set Nov 3, 2026 as the deadline for US federal agencies");
    expect(text).toContain("ransomware groups use this flaw");
  });
  it("says when the federal deadline has passed", async () => {
    const { kevFix } = await import("./db");
    expect(kevFix([{ sourceId: "cisa-kev", metadata: { dueDate: "2026-10-16" } }], new Date("2026-10-25T00:00:00Z"))).toContain("Oct 16, 2026, has passed");
  });
  it("says nothing without a CISA KEV entry", async () => {
    const { kevFix } = await import("./db");
    expect(kevFix([{ sourceId: "circl-sightings", metadata: {} }])).toBeUndefined();
  });
});

describe("firstSentence and defaultQuestion", () => {
  it("keeps the first full sentence and cuts long ones at a word", async () => {
    const { firstSentence } = await import("./db");
    expect(firstSentence("PHP has a flaw in request memory handling. Some contexts may not reset.")).toBe("PHP has a flaw in request memory handling.");
    const long = firstSentence(`A ${"very ".repeat(60)}long sentence.`);
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(171);
  });
  it("asks about the product, or nothing when the product is unknown", async () => {
    const { defaultQuestion } = await import("./db");
    expect(defaultQuestion("Ivanti", "Connect Secure")).toBe("Do we run Ivanti Connect Secure? If yes, is it patched or cut off from the internet?");
    expect(defaultQuestion("n/a", "n/a")).toBeNull();
  });
});

describe("evidence helpers", () => {
  it("dedupes rows with the same source, title and day and keeps the first", async () => {
    const { dedupeEvidence } = await import("./db");
    const d = (iso: string) => new Date(iso);
    const u = "https://example.org/report-a";
    const rows = [
      { sourceId: "circl", url: u, title: "Sighting of CVE-2026-1 ", publishedAt: d("2026-11-06T10:00:00Z") },
      { sourceId: "circl", url: u, title: "Sighting of CVE-2026-1", publishedAt: d("2026-11-06T04:00:00Z") },
      { sourceId: "circl", url: u, title: "Sighting of CVE-2026-1", publishedAt: d("2026-11-05T23:00:00Z") },
      { sourceId: "cisa-kev", url: u, title: "Sighting of CVE-2026-1", publishedAt: d("2026-11-06T04:00:00Z") },
      { sourceId: "circl", url: u, title: "Sighting of CVE-2026-1", publishedAt: null, observedAt: d("2026-11-06T04:00:00Z") },
      // A second publisher's report of the same sighting keeps its own link and stays.
      { sourceId: "circl", url: "https://example.org/report-b", title: "Sighting of CVE-2026-1", publishedAt: d("2026-11-06T04:00:00Z") },
    ];
    const out = dedupeEvidence(rows, (r) => r);
    expect(out.map((r) => `${r.url.slice(-1)} ${r.publishedAt?.toISOString() ?? "observed"}`)).toEqual(["a 2026-11-06T10:00:00.000Z", "a 2026-11-05T23:00:00.000Z", "a 2026-11-06T04:00:00.000Z", "b 2026-11-06T04:00:00.000Z"]);
  });
  it("shows a midnight UTC first-seen time as a plain date", async () => {
    const { asDisplayDate } = await import("./db");
    expect(asDisplayDate(new Date("2026-11-06T00:00:00Z"))).toBe("2026-11-06");
    expect(asDisplayDate(new Date("2026-11-06T13:05:00Z"))).toBe("2026-11-06T13:05:00.000Z");
  });
});

describe("NEW and CHANGED marks", () => {
  it("marks by the event's first and latest history rows within 7 days", async () => {
    const { changeMarks } = await import("./db");
    const hist = (eventId: string, at: Date) => current.insert(schema.verdictHistory).values({ eventId, verdict: "watch", ladder: LADDER, rulesVersion: "v2", reason: "r", actor: "rules", changedAt: at });
    for (const id of ["fresh", "moved", "quiet"]) await ev(id, "watch");
    await hist("fresh", day(8));
    await hist("moved", day(1));
    await hist("moved", day(9));
    await hist("quiet", day(1));
    const m = await changeMarks(current as never, ["fresh", "moved", "quiet", "none"], NOW);
    expect(Object.fromEntries(m)).toEqual({ fresh: "new", moved: "changed" });
    const home = await dbHomeEvents();
    expect(home.items.find((x) => x.row.id === "fresh")?.row.mark).toBe("new");
    expect(home.items.find((x) => x.row.id === "quiet")?.row.mark).toBeUndefined();
  });
});
