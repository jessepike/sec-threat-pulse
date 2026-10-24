import { describe, expect, it } from "vitest";
import { median, peakBeforeConfirmation, quantile, score, wilson, type Period } from "./score";
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
const opts = { dataEnd: "2026-09-30", period };

describe("score", () => {
  it("counts a true Act now call made before KEV, with its lead time", () => {
    const r = R("A", [T("2026-01-01", "low"), T("2026-02-01", "watch"), T("2026-02-10", "act_now")], { kevDate: "2026-02-15", confirmedAt: "2026-02-15", confirmedBy: "cisa-kev", stratum: "kev" });
    const c = score([r], opts);
    expect(c.actNow.all).toMatchObject({ n: 1, hits: 1, rate: 1 });
    expect(c.actNow.preConfirmation).toMatchObject({ n: 1, hits: 1 });
    expect(c.actNow.postConfirmation).toBe(0);
    expect(c.leadTime).toMatchObject({ kevInPeriod: 1, called: 1, calledBeforeKev: 1, medianPreKev: 5, medianAll: 5, watchCalledBeforeKev: 1, medianWatchLead: 14 });
    expect(c.leadTime.shareBeforeKev).toMatchObject({ n: 1, hits: 1 });
    expect(c.coverage).toMatchObject({ actNowOnKevDay: 1, actNowEver: 1 });
    // Low from Jan 1 to Jan 31; confirmation Feb 15 is within 30 days of Jan 31, so the hold failed.
    expect(c.low.hold).toMatchObject({ n: 1, hits: 0 });
    expect(c.low.missed).toEqual(["A"]);
    // Always Low over the same days would also have failed.
    expect(c.low.alwaysLow).toMatchObject({ n: 1, hits: 0 });
    expect(c.confusion.act_now.exploited).toBe(1);
  });

  it("scores a false Act now and a Low that held", () => {
    const fp = R("B", [T("2026-01-01", "act_now")]);
    const held = R("C", [T("2026-01-01", "low")]);
    const c = score([fp, held], opts);
    expect(c.actNow.all).toMatchObject({ n: 1, hits: 0, rate: 0 });
    expect(c.low.hold).toMatchObject({ n: 1, hits: 1, rate: 1 });
    expect(c.low.alwaysLow).toMatchObject({ n: 2, hits: 2 });
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

  it("places each call in the period of the call day, not the outcome day", () => {
    // Act now on Mar 20, KEV listing Apr 10: a tuning period call, even though the outcome is later.
    const r = R("F", [T("2026-01-01", "low"), T("2026-03-20", "act_now")], { kevDate: "2026-04-10", confirmedAt: "2026-04-10", stratum: "kev" });
    const tuning = score([r], { ...opts, period: { name: "t", from: "2026-01-01", to: "2026-03-31" } });
    const held = score([r], { ...opts, period: { name: "h", from: "2026-04-01", to: "2026-06-30" } });
    expect(tuning.actNow.preConfirmation).toMatchObject({ n: 1, hits: 1 });
    expect(held.actNow.preConfirmation.n).toBe(0);
    expect(tuning.leadTime.kevInPeriod).toBe(0);
    expect(held.leadTime.kevInPeriod).toBe(1);
    // The Low days Jan 1 to Mar 19 are tuning period days; confirmation Apr 10 is within 30 days of Mar 19.
    expect(tuning.low.hold).toMatchObject({ n: 1, hits: 0 });
    expect(held.low.hold.n).toBe(0);
  });

  it("splits a Low stretch at the period boundary", () => {
    // Low all the way, confirmation Sep 1. Jan to Mar piece held (Sep 1 is more than 30 days after Mar 31); Apr to Jun piece did not hold? Jun 30 + 30 = Jul 30 < Sep 1, so it held too.
    const r = R("G", [T("2026-01-01", "low")], { confirmedAt: "2026-09-01", end: "2026-08-31" });
    const early = score([r], { ...opts, dataEnd: "2026-12-31", period: { name: "t", from: "2026-01-01", to: "2026-03-31" } });
    const late = score([r], { ...opts, dataEnd: "2026-12-31", period: { name: "h", from: "2026-07-01", to: "2026-08-31" } });
    expect(early.low.hold).toMatchObject({ n: 1, hits: 1 });
    expect(late.low.hold).toMatchObject({ n: 1, hits: 0 });
  });

  it("applies weights and reports Wilson intervals", () => {
    const weighted = score([R("H", [T("2026-01-01", "low")], { stratum: "random" }), R("I", [T("2026-01-01", "low")], { stratum: "signal", confirmedAt: "2026-01-20" })], { ...opts, weights: { random: 10, signal: 1 } });
    expect(weighted.low.hold.rate).toBe(0.5);
    expect(weighted.low.hold.weightedRate).toBeCloseTo(10 / 11);
    expect(weighted.low.hold.effectiveN).toBeCloseTo(121 / 101);
    expect(weighted.low.hold.ci![0]).toBeLessThan(0.5);
    expect(weighted.low.hold.ci![1]).toBeGreaterThan(0.5);
    expect(weighted.low.hold.weightedCi![1]).toBeLessThanOrEqual(1);
  });

  it("counts churn and downgrades inside the period", () => {
    const r = R("J", [T("2026-01-01", "watch"), T("2026-01-10", "low"), T("2026-01-20", "watch")]);
    const c = score([r], opts);
    expect(c.churn).toMatchObject({ transitionsPerCve: 3, downgrades: 1, cvesWithDowngrade: 1, cvesWithThreePlusTransitions: 1 });
    const later = score([r], { ...opts, period: { name: "x", from: "2026-01-15", to: "2026-06-30" } });
    expect(later.churn).toMatchObject({ transitionsPerCve: 1, downgrades: 0 });
  });
});

describe("helpers", () => {
  it("median, quantile and peak", () => {
    expect(median([])).toBeUndefined();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(peakBeforeConfirmation(R("L", [T("2026-01-01", "low"), T("2026-02-01", "watch"), T("2026-03-01", "act_now")], { confirmedAt: "2026-03-01" }))).toBe("watch");
    expect(peakBeforeConfirmation(R("M", []))).toBe("none");
  });

  it("wilson interval matches a known value", () => {
    // 26 of 43: about 46% to 74%.
    const [lo, hi] = wilson(26, 43)!;
    expect(lo).toBeCloseTo(0.458, 2);
    expect(hi).toBeCloseTo(0.736, 2);
    expect(wilson(0, 0)).toBeUndefined();
    expect(wilson(0, 10)![0]).toBe(0);
    expect(wilson(10, 10)![1]).toBe(1);
  });
});
