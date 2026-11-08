import { describe, expect, it } from "vitest";
import type { SourceHealth } from "@/lib/ingest/health";
import { buildHealth, downReport, type HealthInput } from "./health";

const now = new Date("2026-11-08T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const src = (id: string, state: SourceHealth["state"], lastSuccessAt: string | null = ago(10)): SourceHealth => ({ id, name: id, state, reason: state === "ok" ? "" : "Broken.", lastSuccessAt });

function input(over: Partial<HealthInput> = {}): HealthInput {
  return {
    sources: [src("cisa-kev", "ok"), src("epss", "ok"), src("vulncheck-kev", "unconfigured", null)],
    eventsSync: { id: "events-sync", name: "Event builder", state: "ok", reason: "", lastSuccessAt: ago(8) },
    eventsSyncAttemptAt: ago(8),
    sourcesAttemptAt: ago(3),
    database: { id: "database-size", name: "Database storage", state: "ok", reason: "" },
    counts: { act_now: 75, watch: 37, low: 0, total: 112 },
    newestEvidenceAt: ago(40),
    ...over,
  };
}

describe("buildHealth", () => {
  it("is ok when the events cron completed within the hour", () => {
    const r = buildHealth(input(), now);
    expect(r.state).toBe("ok");
    expect(r.lastCompleteAt).toBe(ago(8));
    expect(r.lastAttemptAt).toBe(ago(3));
    expect(r.nextRunDueAt).toBe(ago(8 - 15));
    expect(r.summary).toBe("Fresh. The last complete run was 8 minutes ago and every source is current.");
    expect(r.sources).toMatchObject({ total: 3, ok: 2, failing: 0, stale: 0, unconfigured: 1 });
    expect(r.rulesVersion).toBe("v3");
    expect(r.counts.total).toBe(112);
  });
  it("keeps the last complete time apart from the last attempt and reports delay", () => {
    const r = buildHealth(input({ eventsSync: { id: "events-sync", name: "Event builder", state: "stale", reason: "No success.", lastSuccessAt: ago(95) }, eventsSyncAttemptAt: ago(2) }), now);
    expect(r.state).toBe("delayed");
    expect(r.lastCompleteAt).toBe(ago(95));
    expect(r.lastAttemptAt).toBe(ago(2));
    expect(r.summary).toContain("95 minutes ago");
    expect(r.summary).toContain("last good data");
  });
  it("counts unhealthy sources in the summary without changing a fresh state", () => {
    const r = buildHealth(input({ sources: [src("cisa-kev", "ok"), src("nvd", "failing"), src("circl", "stale", ago(400))] }), now);
    expect(r.state).toBe("ok");
    expect(r.summary).toContain("2 of 3 sources need attention");
    expect(r.sources.list.map((s) => s.id)).toEqual(["circl", "cisa-kev", "nvd"]);
  });
  it("is down with no data and no completed run", () => {
    const r = downReport(now);
    expect(r.state).toBe("down");
    expect(r.counts.total).toBe(0);
    expect(r.lastCompleteAt).toBeNull();
  });
  it("never writes an em dash", () => {
    expect(JSON.stringify(buildHealth(input(), now))).not.toMatch(/—/);
  });
});
