import { describe, expect, it } from "vitest";
import { anchorDay, median, peakBeforeConfirmation, score, type Period } from "./score";
import type { CveReplay, VerdictTransition } from "./types";

const T = (day: string, verdict: VerdictTransition["verdict"]): VerdictTransition => ({ day, verdict, reason: "" });
const R = (cveId: string, transitions: VerdictTransition[], p: Partial<CveReplay> = {}): CveReplay => ({
  cveId,
  stratum: "signal",
  start: "2026-01-01",
  end: "2026-06-30",
  transitions,
  ...p,
});
const period: Period = { name: "all", from: "2026-01-01", to: "2026-06-30" };
const opts = { dataEnd: "2026-09-30", period, anchors: {} };

describe("score", () => {
  it("counts a true Act now call made before KEV, with its lead time", () => {
    const r = R("A", [T("2026-01-01", "low"), T("2026-02-01", "watch"), T("2026-02-10", "act_now")], { kevDate: "2026-02-15", confirmedAt: "2026-02-15", confirmedBy: "cisa-kev", stratum: "kev" });
    const c = score([r], opts);
    expect(c.actNow.all).toMatchObject({ n: 1, hits: 1, rate: 1 });
    expect(c.actNow.preConfirmation).toMatchObject({ n: 1, hits: 1 });
    expect(c.actNow.postConfirmation).toBe(0);
    expect(c.leadTime).toMatchObject({ kevInPeriod: 1, called: 1, calledBeforeKev: 1, medianPreKev: 5, medianAll: 5, watchCalledBeforeKev: 1, medianWatchLead: 14 });
    expect(c.coverage).toMatchObject({ actNowOnKevDay: 1, actNowEver: 1 });
    // Low from Jan 1 to Jan 31; confirmation Feb 15 is within 30 days of Jan 31, so the hold failed.
    expect(c.low.hold).toMatchObject({ n: 1, hits: 0 });
    expect(c.low.missed).toEqual(["A"]);
    expect(c.confusion.act_now.exploited).toBe(1);
  });

  it("scores a false Act now and a Low that held", () => {
    const fp = R("B", [T("2026-01-01", "act_now")]);
    const held = R("C", [T("2026-01-01", "low")]);
    const c = score([fp, held], opts);
    expect(c.actNow.all).toMatchObject({ n: 1, hits: 0, rate: 0 });
    expect(c.low.hold).toMatchObject({ n: 1, hits: 1, rate: 1 });
    expect(c.confusion.act_now.notExploited).toBe(1);
    expect(c.confusion.low.notExploited).toBe(1);
  });

  it("treats a call after confirmation as a post confirmation call with zero or negative lead", () => {
    const r = R("D", [T("2026-01-01", "low"), T("2026-03-05", "act_now")], { kevDate: "2026-03-01", confirmedAt: "2026-03-01", confirmedBy: "cisa-kev", stratum: "kev" });
    const c = score([r], opts);
    expect(c.actNow.all.hits).toBe(1);
    expect(c.actNow.postConfirmation).toBe(1);
    expect(c.actNow.preConfirmation.n).toBe(0);
    expect(c.leadTime.medianAll).toBe(-4);
    expect(c.leadTime.calledBeforeKev).toBe(0);
    expect(c.coverage.actNowOnKevDay).toBe(0);
    expect(c.coverage.actNowEver).toBe(1);
  });

  it("leaves calls without 30 days of follow-up unscored", () => {
    const r = R("E", [T("2026-06-20", "act_now")], { start: "2026-06-20" });
    const c = score([r], { ...opts, dataEnd: "2026-07-01" });
    expect(c.actNow.all.n).toBe(0);
    expect(c.actNow.unscoreable).toBe(1);
    expect(c.low.hold.n).toBe(0);
  });

  it("places CVEs in periods by KEV day, else publish day, and applies weights", () => {
    const a = R("F", [T("2026-01-01", "low")], { stratum: "random" });
    const b = R("G", [T("2026-01-01", "act_now")], { stratum: "signal" });
    const early = score([a, b], { ...opts, period: { name: "p", from: "2026-01-01", to: "2026-03-31" }, anchors: { F: "2026-02-01", G: "2026-05-01" } });
    expect(early.cves).toBe(1);
    const weighted = score([R("H", [T("2026-01-01", "low")], { stratum: "random" }), R("I", [T("2026-01-01", "low")], { stratum: "signal", confirmedAt: "2026-01-20" })], { ...opts, weights: { random: 10, signal: 1 } });
    expect(weighted.low.hold.rate).toBe(0.5);
    expect(weighted.low.hold.weightedRate).toBeCloseTo(10 / 11);
  });

  it("counts churn and downgrades", () => {
    const r = R("J", [T("2026-01-01", "watch"), T("2026-01-10", "low"), T("2026-01-20", "watch")]);
    const c = score([r], opts);
    expect(c.churn).toMatchObject({ transitionsPerCve: 3, downgrades: 1, cvesWithDowngrade: 1, cvesWithThreePlusTransitions: 1 });
  });
});

describe("helpers", () => {
  it("median and anchors and peak", () => {
    expect(median([])).toBeUndefined();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(anchorDay(R("K", []), "2026-02-02")).toBe("2026-02-02");
    expect(anchorDay(R("K", [], { kevDate: "2026-03-03" }), "2026-02-02")).toBe("2026-03-03");
    expect(peakBeforeConfirmation(R("L", [T("2026-01-01", "low"), T("2026-02-01", "watch"), T("2026-03-01", "act_now")], { confirmedAt: "2026-03-01" }))).toBe("watch");
    expect(peakBeforeConfirmation(R("M", []))).toBe("none");
  });
});
