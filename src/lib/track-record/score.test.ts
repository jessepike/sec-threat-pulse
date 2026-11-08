import { describe, expect, it } from "vitest";
import { firstCall, median, scoreCall, scoreLive, type CveHistory, type HistoryRow } from "./score";

const at = (day: string, h = 12) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00Z`);
const row = (verdict: string, day: string, eventId = "e", rulesVersion = "v2"): HistoryRow => ({ eventId, verdict, rulesVersion, at: at(day) });
const cve = (cveId: string, kevDate: string | null, ...rows: HistoryRow[]): CveHistory => ({ cveId, kevDate, rows });

describe("scoreCall", () => {
  it("does not score a call made on or after the listing day", () => {
    expect(scoreCall("C", row("act_now", "2026-10-24"), "2026-10-24", "2026-11-08", 30)).toBeNull();
    expect(scoreCall("C", row("act_now", "2026-10-25"), "2026-10-24", "2026-11-08", 30)).toBeNull();
  });
  it("is right when the listing comes within the horizon, with the lead in days", () => {
    expect(scoreCall("C", row("act_now", "2026-10-01"), "2026-10-31", "2026-11-08", 30)).toMatchObject({ outcome: "right", leadDays: 30 });
  });
  it("is wrong once the horizon has passed with no listing inside it", () => {
    expect(scoreCall("C", row("act_now", "2026-10-01"), "2026-11-01", "2026-11-08", 30)).toMatchObject({ outcome: "wrong" });
    expect(scoreCall("C", row("act_now", "2026-10-01"), null, "2026-11-01", 30)).toMatchObject({ outcome: "wrong" });
  });
  it("is pending until the horizon passes", () => {
    expect(scoreCall("C", row("act_now", "2026-10-01"), null, "2026-10-31", 30)).toMatchObject({ outcome: "pending", settlesOn: "2026-10-31" });
  });
});

describe("firstCall", () => {
  it("takes the earliest row at or above the verdict across events", () => {
    const rows = [row("watch", "2026-10-02", "a"), row("act_now", "2026-10-05", "a"), row("act_now", "2026-10-04", "b"), row("low", "2026-10-01", "a")];
    expect(firstCall(rows, "act_now")).toMatchObject({ eventId: "b" });
    expect(firstCall(rows, "watch")?.at).toEqual(at("2026-10-02"));
    expect(firstCall([row("low", "2026-10-01")], "watch")).toBeUndefined();
  });
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });
});

describe("scoreLive", () => {
  const now = at("2026-12-15");
  const rec = scoreLive(
    [
      // Early call, listed 4 days later: right.
      cve("CVE-1", "2026-10-28", row("watch", "2026-10-24", "early-cve-1"), row("act_now", "2026-10-24", "early-cve-1", "v2")),
      // Early call, never listed, horizon passed: wrong.
      cve("CVE-2", null, row("act_now", "2026-10-26", "early-cve-2", "v2")),
      // Call after listing: counted apart.
      cve("CVE-3", "2026-09-01", row("act_now", "2026-10-24", "kev-x")),
      // Recent call under v3: pending.
      cve("CVE-4", null, row("act_now", "2026-12-01", "early-cve-4", "v3")),
      // Watch then listed 60 days later: a right Watch call, never Act now.
      cve("CVE-5", "2026-12-10", row("watch", "2026-10-11", "w")),
      // Listed after history began with no call before it.
      cve("CVE-6", "2026-11-20", row("act_now", "2026-11-20", "kev-y")),
    ],
    now,
  );

  it("scores Act now calls made before confirmation", () => {
    expect(rec.since).toBe("2026-10-11");
    expect(rec.actNow.overall).toMatchObject({ calls: 3, right: 1, wrong: 1, pending: 1, rate: 0.5, medianLeadDays: 4 });
    expect(rec.actNow.postConfirmation).toBe(2);
    expect(rec.actNow.calls.map((c) => [c.cveId, c.outcome])).toEqual([
      ["CVE-4", "pending"],
      ["CVE-2", "wrong"],
      ["CVE-1", "right"],
    ]);
  });

  it("splits by the rules version that made the call", () => {
    expect(Object.keys(rec.actNow.byVersion)).toEqual(["v2", "v3"]);
    expect(rec.actNow.byVersion.v2).toMatchObject({ calls: 2, right: 1, wrong: 1 });
    expect(rec.actNow.byVersion.v3).toMatchObject({ calls: 1, pending: 1, rate: undefined });
  });

  it("scores Watch or higher at 90 days", () => {
    expect(rec.watch.overall).toMatchObject({ right: 2, wrong: 0 });
  });

  it("counts KEV listings after history began and the share called before", () => {
    expect(rec.kevCoverage).toMatchObject({ listings: 3, calledBefore: 1, medianLeadDays: 4 });
    expect(rec.kevCoverage.share).toBeCloseTo(1 / 3);
  });

  it("is empty without history", () => {
    const empty = scoreLive([], now);
    expect(empty.actNow.overall).toMatchObject({ calls: 0, rate: undefined });
    expect(empty.kevCoverage.share).toBeUndefined();
  });
});
