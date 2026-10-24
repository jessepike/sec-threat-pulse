import { describe, expect, it, vi } from "vitest";
import { applyOverride, clearOverride, validateOverride } from "../override";
import type { Db } from "../db";

describe("validateOverride", () => {
  it("requires a reason", () => {
    expect(validateOverride({ verdict: "watch", reason: "" }).ok).toBe(false);
    expect(validateOverride({ verdict: "watch", reason: "   " }).ok).toBe(false);
    expect(validateOverride({ verdict: "watch", reason: "short" }).ok).toBe(false);
  });
  it("requires a valid verdict", () => {
    expect(validateOverride({ verdict: "panic", reason: "a long enough reason" }).ok).toBe(false);
    expect(validateOverride({ verdict: undefined, reason: "a long enough reason" }).ok).toBe(false);
  });
  it("accepts and trims a good input", () => {
    const r = validateOverride({ verdict: "act_now", reason: "  Confirmed by vendor advisory  " });
    expect(r).toEqual({ ok: true, value: { verdict: "act_now", reason: "Confirmed by vendor advisory" } });
  });
  it("rejects an overlong reason", () => {
    expect(validateOverride({ verdict: "low", reason: "x".repeat(1001) }).ok).toBe(false);
  });
});

function mockDb() {
  const calls: Array<{ op: string; table: unknown; values?: unknown }> = [];
  const chain = (op: string, table: unknown) => ({
    values: (values: unknown) => {
      calls.push({ op, table, values });
      return { __q: calls.length };
    },
    set: (values: unknown) => {
      calls.push({ op, table, values });
      return { where: () => ({ __q: calls.length }) };
    },
  });
  const batch = vi.fn(async (q: unknown[]) => q);
  const db = {
    insert: (t: unknown) => chain("insert", t),
    update: (t: unknown) => chain("update", t),
    batch,
  } as unknown as Db;
  return { db, calls, batch };
}

const event = { id: "e1", ladder: { talk: "confirmed" }, rulesVersion: "v0", verdict: "low" };

describe("applyOverride", () => {
  it("writes event, verdict_history, corrections and audit in one batch", async () => {
    const { db, calls, batch } = mockDb();
    await applyOverride(db, { actor: "jessepike", event, verdict: "act_now", reason: "Exploited in the wild" });
    expect(batch).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(4);
    const byOp = calls.map((c) => c.values as Record<string, unknown>);
    expect(byOp[0]).toMatchObject({ overrideVerdict: "act_now", overrideReason: "Exploited in the wild" });
    expect(byOp[1]).toMatchObject({ eventId: "e1", verdict: "act_now", actor: "admin:jessepike" });
    expect(byOp[2]).toMatchObject({ eventId: "e1", actor: "admin:jessepike" });
    expect(byOp[3]).toMatchObject({ actor: "jessepike", action: "event.override", target: "e1" });
  });
});

describe("clearOverride", () => {
  it("returns to the rules verdict and audits", async () => {
    const { db, calls } = mockDb();
    await clearOverride(db, { actor: "jessepike", event, reason: "Rules now agree" });
    const v = calls.map((c) => c.values as Record<string, unknown>);
    expect(v[0]).toMatchObject({ overrideVerdict: null, overrideReason: null });
    expect(v[1]).toMatchObject({ verdict: "low", actor: "admin:jessepike" });
    expect(v[3]).toMatchObject({ action: "event.override_clear" });
  });
});
