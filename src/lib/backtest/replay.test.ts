import { describe, expect, it } from "vitest";
import { circlObservation, confirmation, epssAsOf, firstDayAtLeast, replayCve, stateAsOf, verdictOn } from "./replay";
import type { BacktestCve } from "./types";

const base = (p: Partial<BacktestCve> = {}): BacktestCve => ({
  cveId: "CVE-2026-1000",
  stratum: "signal",
  published: "2026-01-10",
  cvss: 9.8,
  vendor: "Acme",
  product: "Gateway",
  epss: [],
  metasploit: [],
  pocGithub: [],
  exploitdb: [],
  circl: [],
  ...p,
});

describe("epssAsOf", () => {
  it("holds the last change point at or before the day", () => {
    const pts: [string, number][] = [["2026-01-01", 0.01], ["2026-01-10", 0.5], ["2026-02-01", 0.9]];
    expect(epssAsOf(pts, "2025-12-31")).toBeUndefined();
    expect(epssAsOf(pts, "2026-01-01")).toBe(0.01);
    expect(epssAsOf(pts, "2026-01-15")).toBe(0.5);
    expect(epssAsOf(pts, "2026-03-01")).toBe(0.9);
  });
});

describe("stateAsOf", () => {
  it("only includes signals public on or before the day", () => {
    const cve = base({
      kev: { dateAdded: "2026-02-01", ransomware: true },
      metasploit: ["2026-01-20"],
      pocGithub: [{ created: "2026-01-12", stars: 3 }, { created: "2026-01-25", stars: 10 }],
      epss: [["2026-01-10", 0.1], ["2026-01-21", 0.6]],
    });
    const early = stateAsOf(cve, "2026-01-15");
    expect(early.observations.map((o) => o.sourceId)).toEqual(["poc-github"]);
    expect(early.ctx).toMatchObject({ exploitMaturity: "poc", epss: 0.1, kevRansomware: false, pocRepoCount: 1, daysSincePublished: 5, cvss: 9.8 });

    const mid = stateAsOf(cve, "2026-01-21");
    expect(mid.observations.map((o) => o.sourceId).sort()).toEqual(["metasploit", "poc-github"]);
    expect(mid.ctx.exploitMaturity).toBe("weaponized");
    expect(mid.ctx.epss).toBe(0.6);

    const late = stateAsOf(cve, "2026-02-01");
    expect(late.observations.some((o) => o.sourceId === "cisa-kev" && o.kind === "exploited" && o.strength === "confirmed")).toBe(true);
    expect(late.ctx.kevRansomware).toBe(true);
    expect(late.ctx.pocRepoCount).toBe(2);
  });

  it("maps SSVC active to confirmed exploitation and SSVC poc to maturity", () => {
    const poc = stateAsOf(base({ ssvc: { poc: "2026-01-11" } }), "2026-01-12");
    expect(poc.ctx.exploitMaturity).toBe("poc");
    const active = stateAsOf(base({ ssvc: { active: "2026-01-11", poc: "2026-01-11" } }), "2026-01-12");
    expect(active.observations).toEqual([{ sourceId: "cvelist", kind: "exploited", strength: "confirmed", metadata: { ssvc: { exploitation: "active" } } }]);
  });
});

describe("circlObservation", () => {
  it("maps honeypots to confirmed attempts, reports to reported exploitation, catalogs to nothing", () => {
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "honeypot", sourceId: "shadowserver" }, false)).toMatchObject({ kind: "attempts", strength: "confirmed" });
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "telegram", sourceId: "telegram" }, false)).toMatchObject({ kind: "exploited", strength: "reported" });
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" }, false)).toBeUndefined();
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" }, true)).toMatchObject({ kind: "exploited", strength: "reported" });
    expect(circlObservation({ type: "poc", date: "2026-01-01", sourceKind: "other", sourceId: "github.com" }, false)).toMatchObject({ kind: "exploit_available" });
  });
});

describe("confirmation", () => {
  it("takes the earliest of KEV, VulnCheck, SSVC active and two independent reports", () => {
    expect(confirmation(base())).toEqual({});
    expect(confirmation(base({ kev: { dateAdded: "2026-03-01", ransomware: false }, ssvc: { active: "2026-02-20" } }))).toEqual({ at: "2026-02-20", by: "ssvc-active" });
    const reports = base({
      circl: [
        { type: "exploited", date: "2026-01-15", sourceKind: "telegram", sourceId: "telegram" },
        { type: "exploited", date: "2026-01-16", sourceKind: "telegram", sourceId: "telegram" },
        { type: "exploited", date: "2026-01-20", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" },
        { type: "exploited", date: "2026-01-22", sourceKind: "honeypot", sourceId: "shadowserver" },
      ],
    });
    expect(confirmation(reports)).toEqual({ at: "2026-01-22", by: "two-reports" });
  });
});

describe("replayCve", () => {
  it("starts at the publish day, records only verdict changes, and never reads the future", () => {
    const cve = base({ kev: { dateAdded: "2026-02-01", ransomware: true }, epss: [["2026-01-10", 0.01]] });
    const r = replayCve(cve, { rulesVersion: "v0", from: "2026-01-01", to: "2026-02-10" });
    expect(r.start).toBe("2026-01-10");
    expect(r.transitions.map((t) => [t.day, t.verdict])).toEqual([["2026-01-10", "low"], ["2026-02-01", "act_now"]]);
    expect(r.confirmedAt).toBe("2026-02-01");
    expect(r.confirmedBy).toBe("cisa-kev");
    expect(verdictOn(r, "2026-01-31")).toBe("low");
    expect(verdictOn(r, "2026-02-01")).toBe("act_now");
    expect(verdictOn(r, "2026-01-01")).toBeUndefined();
    expect(firstDayAtLeast(r, "watch")).toBe("2026-02-01");
  });

  it("starts at the window start for CVEs published earlier and handles empty windows", () => {
    const cve = base({ published: "2020-01-01" });
    expect(replayCve(cve, { rulesVersion: "v0", from: "2026-01-01", to: "2026-01-03" }).start).toBe("2026-01-01");
    expect(replayCve(base({ published: "2026-05-01" }), { rulesVersion: "v0", from: "2026-01-01", to: "2026-01-03" }).transitions).toEqual([]);
  });
});
