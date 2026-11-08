import { describe, expect, it } from "vitest";
import { evaluateV2 } from "./v2";
import { evaluateV3, scoreFor, tierFor } from "./v3";
import { EMPTY_LADDER, type Ladder } from "../types";
import type { VerdictContext } from "./types";

const L = (p: Partial<Ladder>): Ladder => ({ ...EMPTY_LADDER, ...p });
const none = { exploitMaturity: "none" as const };
const confirmed = L({ exploited: "confirmed", attempts: "confirmed" });
const reported = L({ exploited: "reported", attempts: "reported" });

describe("rules v3: verdicts are v2's", () => {
  it("agrees with v2 on verdict, rule id and reason across a grid", () => {
    const ladders = [EMPTY_LADDER, L({ attempts: "reported" }), L({ damage: "reported" }), reported, confirmed];
    const ctxs: VerdictContext[] = [
      none,
      { ...none, daysSincePublished: 5, reportedExploitationSources: ["a"] },
      { ...none, daysSincePublished: 5, reportedExploitationSources: ["a", "b"] },
      { ...none, daysSincePublished: 400 },
      { exploitMaturity: "weaponized", daysSincePublished: 400, kevRansomware: true, daysSinceConfirmed: 2 },
      { ...none, epss: 0.6, cvss: 9.8, vendor: "Fortinet", product: "FortiOS", categoryId: "edge" },
    ];
    for (const l of ladders)
      for (const c of ctxs) {
        const a = evaluateV2(l, c);
        const b = evaluateV3(l, c);
        expect([b.verdict, b.ruleId, b.reason]).toEqual([a.verdict, a.ruleId, a.reason]);
      }
  });
});

describe("rules v3: the Act today tier", () => {
  const edge = { ...none, categoryId: "edge", daysSincePublished: 10 };

  it("needs confirmed exploitation inside the window plus exposure, ransomware or tools", () => {
    expect(evaluateV3(confirmed, { ...edge, daysSinceConfirmed: 3 }).tier).toBe("today");
    expect(evaluateV3(confirmed, { ...edge, daysSinceConfirmed: 14 }).tier).toBe("today");
    expect(evaluateV3(confirmed, { ...edge, daysSinceConfirmed: 15 }).tier).toBe("now");
    expect(evaluateV3(confirmed, { ...edge, daysSinceConfirmed: undefined }).tier).toBe("now");
    expect(evaluateV3(confirmed, { ...none, daysSincePublished: 10, daysSinceConfirmed: 3 }).tier).toBe("now");
    expect(evaluateV3(confirmed, { ...none, daysSincePublished: 10, daysSinceConfirmed: 3, kevRansomware: true }).tier).toBe("today");
    expect(evaluateV3(confirmed, { exploitMaturity: "weaponized", daysSincePublished: 10, daysSinceConfirmed: 3 }).tier).toBe("today");
  });

  it("never tiers a reported-only Act now, and sets no tier below Act now", () => {
    const r = evaluateV3(reported, { ...edge, daysSinceFirstReport: 1, reportedExploitationSources: ["a", "b"] });
    expect(r.verdict).toBe("act_now");
    expect(r.tier).toBe("now");
    expect(evaluateV3(L({ attempts: "reported" }), edge).tier).toBeUndefined();
    expect(evaluateV3(EMPTY_LADDER, edge).tier).toBeUndefined();
  });

  it("falls back to the v0 edge patterns when no category is given", () => {
    expect(tierFor(confirmed, { ...none, vendor: "Ivanti", product: "Connect Secure", daysSinceConfirmed: 1 })).toBe("today");
    expect(tierFor(confirmed, { ...none, vendor: "Acme", product: "Spreadsheet", daysSinceConfirmed: 1 })).toBe("now");
  });

  it("takes a study window", () => {
    expect(tierFor(confirmed, { ...edge, daysSinceConfirmed: 25 }, 30)).toBe("today");
    expect(tierFor(confirmed, { ...edge, daysSinceConfirmed: 25 }, 14)).toBe("now");
  });
});

describe("rules v3: the score", () => {
  it("adds one line per factor and caps at 11", () => {
    const full = scoreFor(confirmed, { exploitMaturity: "weaponized", kevRansomware: true, categoryId: "edge", daysSinceConfirmed: 0, affectedProductCount: 5 });
    expect(full.score).toBe(11);
    expect(full.why).toHaveLength(6);
    expect(full.why[0]).toBe("Exploitation is confirmed by an authoritative source.");
    expect(scoreFor(EMPTY_LADDER, none)).toEqual({ score: 0, why: [] });
  });

  it("ranks confirmed exposed flaws above reported ones and fresh above stale", () => {
    const s = (l: Ladder, c: VerdictContext) => scoreFor(l, c).score;
    expect(s(confirmed, { ...none, categoryId: "edge", daysSinceConfirmed: 2 })).toBeGreaterThan(s(reported, { ...none, categoryId: "edge", daysSinceFirstReport: 2 }));
    expect(s(confirmed, { ...none, daysSinceConfirmed: 2 })).toBeGreaterThan(s(confirmed, { ...none, daysSinceConfirmed: 60 }));
    expect(s(confirmed, { ...none, daysSinceConfirmed: 10 })).toBe(4);
    expect(s(confirmed, { ...none, embedsComponent: true })).toBe(4);
  });

  it("uses the first report date when exploitation is not confirmed", () => {
    const r = scoreFor(reported, { ...none, daysSinceFirstReport: 1, daysSinceConfirmed: 300 });
    expect(r.why).toContain("The first report is 1 day old.");
  });
});
