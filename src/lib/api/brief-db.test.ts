import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/ingest/testdb";
import * as schema from "@/lib/db/schema";

let current: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/lib/db/client", async () => ({ getDb: () => current, schema: await import("@/lib/db/schema") }));

const { apiBrief, apiCheckStack, parseStack } = await import("./v1");

const LADDER = { talk: "confirmed", exposure: "none", attempts: "none", exploited: "confirmed", damage: "none" };
const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12));
const NOW = Date.UTC(2026, 9, 10, 12);
let seq = 0;

async function ev(id: string, verdict: string, over: Partial<typeof schema.events.$inferInsert> = {}) {
  await current.insert(schema.events).values({ id, title: `Title ${id}`, ladder: LADDER, verdict, rulesVersion: "v3", ...over });
  seq += 1;
  await current.insert(schema.observations).values({ sourceId: "s1", dedupeKey: `k${seq}`, kind: "exploited", strength: "confirmed", eventId: id, title: `Obs ${seq}`, url: `https://example.com/${seq}`, publishedAt: day(5) });
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());
beforeEach(async () => {
  current = await createTestDb();
  await current.insert(schema.sources).values({ id: "s1", name: "Source", category: "x", homepage: "https://example.com" });
});

describe("apiBrief", () => {
  it("returns up to five Act now in rank order, tier first, with the sentence and the week id", async () => {
    for (let i = 0; i < 6; i++) await ev(`a${i}`, "act_now", { tier: i === 3 ? "today" : "now", rankScore: 10 - i, vendor: "Acme", product: `P${i}` });
    await ev("w", "watch");
    const b = (await apiBrief(new Date(NOW)))!;
    expect(b.week).toBe("2026-10-05");
    expect(b.top.map((t) => [t.rank, t.id])).toEqual([[1, "a3"], [2, "a0"], [3, "a1"], [4, "a2"], [5, "a4"]]);
    expect(b.top[0].tier).toBe("today");
    expect(b.top[0].doThis.length).toBeGreaterThan(10);
    expect(b.actNowRecent).toBe(6);
    expect(b.weekLine).toBe("6 flaws under attack in the last 30 days need action now. 1 is marked TODAY: exploitation confirmed in the last two weeks, plus a sign of wide use. Start at the top.");
  });

  it("never pads with Watch", async () => {
    await ev("w", "watch");
    const b = (await apiBrief(new Date(NOW)))!;
    expect(b.top).toEqual([]);
    expect(b.weekLine).toMatch(/^No flaw meets the Act now bar/);
  });
});

describe("check stack", () => {
  it("parses a clean list and rejects bad input", () => {
    expect(parseStack("Fortinet, PAN-OS ,fortinet")).toEqual(["fortinet", "pan-os"]);
    expect(parseStack("")).toBeNull();
    expect(parseStack("a")).toBeNull();
    expect(parseStack("x<script>")).toBeNull();
    expect(parseStack(Array.from({ length: 26 }, (_, i) => `v${i}`).join(","))).toBeNull();
  });

  it("returns Act now and Watch events per product, skipping Low", async () => {
    await ev("f1", "act_now", { vendor: "Fortinet", product: "FortiOS" });
    await ev("f2", "watch", { vendor: "Fortinet", product: "FortiWeb" });
    await ev("f3", "low", { vendor: "Fortinet", product: "FortiMail" });
    await ev("i1", "act_now", { vendor: "Ivanti", product: "Connect Secure" });
    const r = (await apiCheckStack(["fortinet", "citrix"]))!;
    expect(r.results.map((x) => [x.query, x.matched, x.actNow, x.events.map((e) => e.id)])).toEqual([
      ["fortinet", 2, 1, ["f1", "f2"]],
      ["citrix", 0, 0, []],
    ]);
    expect(r.actNowTotal).toBe(1);
  });
});

describe("vendor pages", () => {
  it("groups visible events by vendor and returns one vendor's events in display order", async () => {
    const { dbVendors, dbVendor } = await import("@/lib/data/db");
    await ev("f1", "act_now", { vendor: "Fortinet", product: "FortiOS", tier: "today", rankScore: 9 });
    await ev("f2", "watch", { vendor: "Fortinet", product: "FortiWeb" });
    await ev("h", "act_now", { vendor: "Fortinet", product: "FortiOS", hidden: true });
    await ev("i1", "act_now", { vendor: "Ivanti", product: "Connect Secure" });
    const vs = await dbVendors();
    expect(vs.map((v) => [v.key, v.actNow, v.watch])).toEqual([["fortinet", 1, 1], ["ivanti", 1, 0]]);
    const f = (await dbVendor("fortinet"))!;
    expect(f.rows.map((r) => r.id)).toEqual(["f1", "f2"]);
    expect(f.vendor.products.map((p) => p.slug)).toEqual(["fortinet/fortios", "fortinet/fortiweb"]);
    expect(await dbVendor("nobody")).toBeNull();
  });
});
