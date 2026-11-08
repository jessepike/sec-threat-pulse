import { describe, expect, it } from "vitest";
// The probe's judge lives with the scripts so GitHub Actions can run it without a build.
import { judgeFreshness } from "../../../scripts/ops/judge-freshness.mjs";

const now = new Date("2026-11-08T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

describe("judgeFreshness", () => {
  it("is ok within the hour", () => {
    expect(judgeFreshness({ ok: true, status: 200, body: { state: "ok", lastCompleteAt: ago(12) } }, now).state).toBe("ok");
  });
  it("is stale after an hour and names both clocks", () => {
    const r = judgeFreshness({ ok: true, status: 200, body: { state: "delayed", lastCompleteAt: ago(90), lastAttemptAt: ago(1) } }, now);
    expect(r.state).toBe("stale");
    expect(r.reason).toContain("90 minutes ago");
    expect(r.reason).toContain(ago(1));
  });
  it("is down on a non-JSON or failed answer", () => {
    expect(judgeFreshness({ ok: false, status: 503, body: null }, now)).toMatchObject({ state: "down", reason: expect.stringContaining("HTTP 503") });
    expect(judgeFreshness({ ok: false, status: 0, body: null, error: "fetch failed" }, now).reason).toContain("fetch failed");
    expect(judgeFreshness({ ok: true, status: 200, body: { state: "down", summary: "No data." } }, now)).toMatchObject({ state: "down", reason: "No data." });
  });
});
