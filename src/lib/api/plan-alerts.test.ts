import { describe, expect, it } from "vitest";
// The planner lives with the scripts so GitHub Actions can run it without a build.
import { planAlerts } from "../../../scripts/ops/plan-alerts.mjs";

const now = new Date("2026-11-09T12:00:00Z");
const report = (list: { id: string; state: string; reason?: string }[], database: { state: string; reason: string } | null = { state: "ok", reason: "" }) => ({
  state: "ok",
  sources: { list: list.map((s) => ({ name: s.id.toUpperCase(), reason: "", ...s })) },
  database,
});

describe("planAlerts", () => {
  it("opens one issue per failing or stale source and leaves the rest alone", () => {
    const plan = planAlerts(report([{ id: "nvd", state: "failing", reason: "The last 3 runs failed." }, { id: "epss", state: "stale" }, { id: "hibp", state: "ok" }, { id: "vulncheck-kev", state: "unconfigured" }]), [], now);
    expect(plan.open.map((a) => a.title)).toEqual(["[alert] Source nvd: failing", "[alert] Source epss: not updating"]);
    expect(plan.open[0].body).toContain("The last 3 runs failed.");
    expect(plan.close).toEqual([]);
  });
  it("does not open a second issue while one is open", () => {
    const plan = planAlerts(report([{ id: "nvd", state: "stale" }]), [{ number: 7, title: "[alert] Source nvd: failing" }], now);
    expect(plan).toEqual({ open: [], close: [] });
  });
  it("closes the issue when the source recovers", () => {
    const plan = planAlerts(report([{ id: "nvd", state: "ok" }]), [{ number: 7, title: "[alert] Source nvd: failing" }], now);
    expect(plan.close).toEqual([{ id: "nvd", number: 7 }]);
  });
  it("alerts on database storage and ignores the freshness issue and pull requests", () => {
    const open = [
      { number: 3, title: "[alert] Site freshness: not updating" },
      { number: 4, title: "[alert] Source nvd: failing", pull_request: {} },
    ];
    const plan = planAlerts(report([{ id: "nvd", state: "ok" }], { state: "failing", reason: "The database uses 450 MB of 512 MB (88%)." }), open, now);
    expect(plan.open.map((a) => a.title)).toEqual(["[alert] Source database-size: failing"]);
    expect(plan.close).toEqual([]);
  });
  it("leaves an issue open for a source that is no longer in the report", () => {
    expect(planAlerts(report([]), [{ number: 9, title: "[alert] Source retired: failing" }], now).close).toEqual([]);
  });
  it("does nothing when the report could not be read", () => {
    expect(planAlerts(null, [{ number: 7, title: "[alert] Source nvd: failing" }], now)).toEqual({ open: [], close: [] });
  });
});
