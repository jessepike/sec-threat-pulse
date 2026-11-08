import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/ingest/testdb";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { apiChanges } from "./changes";

const L = (over: Partial<Record<string, string>> = {}) => ({ talk: "confirmed", exposure: "none", attempts: "none", exploited: "none", damage: "none", ...over });
const at = (d: number, h = 12) => new Date(Date.UTC(2026, 10, d, h));
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

async function ev(id: string, verdict: string, hidden = false) {
  await db.insert(schema.events).values({ id, title: `Title ${id}`, ladder: L(), verdict, rulesVersion: "v2", hidden });
}
async function hist(eventId: string, verdict: string, ladder: Record<string, string>, changedAt: Date, actor = "rules", reason: string | null = "Because.") {
  await db.insert(schema.verdictHistory).values({ eventId, verdict, ladder, rulesVersion: "v2", reason, actor, changedAt });
}

describe("apiChanges", () => {
  it("pairs each history row with the one before it and names the kind", async () => {
    await ev("a", "act_now");
    await hist("a", "watch", L(), at(1));
    await hist("a", "watch", L({ attempts: "reported" }), at(2));
    await hist("a", "act_now", L({ attempts: "confirmed", exploited: "confirmed" }), at(3));
    await hist("a", "act_now", L({ attempts: "confirmed", exploited: "confirmed" }), at(4), "admin:jess", "Reviewed.");
    await ev("hidden", "watch", true);
    await hist("hidden", "watch", L(), at(3));
    const out = await apiChanges(db, at(1, 0));
    expect(out.total).toBe(4);
    expect(out.changes.map((c) => [c.eventId, c.kind, c.previousVerdict, c.verdict])).toEqual([
      ["a", "admin", "act_now", "act_now"],
      ["a", "verdict", "watch", "act_now"],
      ["a", "ladder", "watch", "watch"],
      ["a", "new", null, "watch"],
    ]);
    expect(out.changes[1].previousLadder).toEqual(L({ attempts: "reported" }));
    expect(out.changes[3].previousLadder).toBeNull();
    expect(out.changes[0].url).toContain("/events/a");
    expect(out.changes[0].at).toBe(at(4).toISOString());
  });

  it("keeps the previous state even when the previous row is before the window", async () => {
    await ev("b", "watch");
    await hist("b", "low", L(), at(1));
    await hist("b", "watch", L({ exposure: "confirmed" }), at(5));
    const out = await apiChanges(db, at(4));
    expect(out.total).toBe(1);
    expect(out.changes[0]).toMatchObject({ kind: "verdict", previousVerdict: "low", verdict: "watch" });
  });

  it("keeps the override as the public verdict until an admin clears it", async () => {
    await ev("c", "act_now");
    await hist("c", "act_now", L({ exploited: "confirmed" }), at(1));
    await hist("c", "watch", L({ exploited: "confirmed" }), at(2), "admin:jess", "Admin override: vendor says the report is wrong.");
    // The sync keeps writing the rules verdict while the override stands. Publicly nothing moved.
    await hist("c", "act_now", L({ exploited: "confirmed", talk: "reported" }), at(3));
    await hist("c", "act_now", L({ exploited: "confirmed", talk: "reported" }), at(4), "admin:jess", "Admin override cleared: confirmed by a second source.");
    const out = await apiChanges(db, at(1, 0));
    expect(out.changes.map((c) => [c.kind, c.previousVerdict, c.verdict])).toEqual([
      ["admin", "watch", "act_now"],
      ["ladder", "watch", "watch"],
      ["admin", "act_now", "watch"],
      ["new", null, "act_now"],
    ]);
  });
});
