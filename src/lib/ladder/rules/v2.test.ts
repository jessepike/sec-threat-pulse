import { describe, expect, it } from "vitest";
import { evaluateV1 } from "./v1";
import { evaluateV2 } from "./v2";
import { EMPTY_LADDER, type Ladder } from "../types";
import type { VerdictContext } from "./types";

const L = (p: Partial<Ladder>): Ladder => ({ ...EMPTY_LADDER, ...p });
const none = { exploitMaturity: "none" as const };
const reported = L({ exploited: "reported", attempts: "reported" });

describe("rules v2: a single report needs backing", () => {
  const one = { ...none, daysSincePublished: 10, reportedExploitationSources: ["telegram"] };

  it("holds one report at Watch and lifts it with a second report or confirmed attempts", () => {
    const alone = evaluateV2(reported, one);
    expect(alone.verdict).toBe("watch");
    expect(alone.ruleId).toBe("reported-new-single");
    expect(evaluateV2(reported, { ...one, reportedExploitationSources: ["telegram", "telegram"] })).toMatchObject({ verdict: "act_now", ruleId: "reported-new" });
    expect(evaluateV2(reported, { ...one, reportedExploitationSources: ["telegram", "www.example.com"] }).verdict).toBe("act_now");
    expect(evaluateV2(L({ exploited: "reported", attempts: "confirmed" }), one).verdict).toBe("act_now");
    // Tools, proof of concept and EPSS do not count as backing: the backtest found them on the false calls too.
    expect(evaluateV2(reported, { ...one, exploitMaturity: "weaponized", pocRepoCount: 5, epss: 0.4 }).verdict).toBe("watch");
    expect(evaluateV2(reported, { ...one, reportedExploitationSources: [] }).verdict).toBe("watch");
  });

  it("treats a missing source list as one report, and old CVEs as v1 did", () => {
    expect(evaluateV2(reported, { ...none, daysSincePublished: 10 }).verdict).toBe("watch");
    expect(evaluateV2(reported, { ...one, daysSincePublished: 91 })).toMatchObject({ verdict: "watch", ruleId: "reported-old" });
    expect(evaluateV2(reported, { ...one, daysSincePublished: 90, reportedExploitationSources: ["a", "b"] }).verdict).toBe("act_now");
  });
});

describe("rules v2: otherwise identical to v1", () => {
  it("agrees with v1 everywhere except on single reports of new CVEs", () => {
    const ladders = [EMPTY_LADDER, L({ attempts: "reported" }), L({ attempts: "confirmed" }), L({ damage: "reported" }), reported, L({ exploited: "confirmed", attempts: "confirmed" })];
    const ctxs: VerdictContext[] = [
      none,
      { ...none, daysSincePublished: 0 },
      { ...none, daysSincePublished: 90 },
      { ...none, daysSincePublished: 91 },
      { ...none, daysSincePublished: 500, cvss: 9.8 },
      { ...none, daysSincePublished: 2000, kevRansomware: true },
      { exploitMaturity: "weaponized" as const, epss: 0.6, cvss: 7.5, vendor: "Cisco", product: "ASA" },
      { exploitMaturity: "poc" as const, pocRepoCount: 3 },
      { ...none, epss: 0.3 },
      { ...none, daysSincePublished: 10, reportedExploitationSources: ["www.wordfence.com", "telegram"] },
    ];
    for (const l of ladders) {
      for (const c of ctxs) {
        const single = l.exploited === "reported" && l.attempts !== "confirmed" && (c.daysSincePublished ?? Infinity) <= 90 && (c.reportedExploitationSources?.length ?? 1) < 2;
        if (single) expect(evaluateV2(l, c).verdict).toBe("watch");
        else expect(evaluateV2(l, c).verdict, JSON.stringify([l, c])).toBe(evaluateV1(l, c).verdict);
      }
    }
  });

  it("is monotonic in the ladder and returns a ruleId with plain wording", () => {
    const ctxs = [none, { ...none, daysSincePublished: 10 }, { ...none, daysSincePublished: 10, reportedExploitationSources: ["telegram", "telegram"] }, { exploitMaturity: "weaponized" as const, epss: 0.6, cvss: 9.9 }];
    const rank = { low: 0, watch: 1, act_now: 2 };
    for (const ctx of ctxs) {
      const results = [evaluateV2(EMPTY_LADDER, ctx), evaluateV2(L({ attempts: "reported" }), ctx), evaluateV2(reported, ctx), evaluateV2(L({ exploited: "confirmed", attempts: "confirmed" }), ctx)];
      for (let i = 1; i < results.length; i++) expect(rank[results[i].verdict]).toBeGreaterThanOrEqual(rank[results[i - 1].verdict]);
      for (const r of results) {
        expect(r.ruleId).toBeTruthy();
        expect(r.reason).not.toMatch(/[–—]/);
        expect(r.reason).not.toMatch(/, not /);
        expect(r.reason).not.toContain("usually confirmed");
        expect(r.reason.endsWith(".")).toBe(true);
      }
    }
  });
});
