import { describe, expect, it } from "vitest";
import { EMPTY_LADDER } from "../types";
import { evaluateVerdict, wordingVersions } from "./index";
import { inferRuleIdV1, presentReason } from "./reasons";
import { evaluateV1 } from "./v1";

describe("reasons", () => {
  const ladder = { ...EMPTY_LADDER, exploited: "reported" as const, attempts: "reported" as const };
  const ctx = { exploitMaturity: "none" as const, daysSincePublished: 12 };

  it("rewrites the v1 early report sentence without touching the verdict or the rule module", () => {
    const raw = evaluateV1(ladder, ctx);
    expect(raw.reason).toContain("usually confirmed within days");
    expect(inferRuleIdV1(raw)).toBe("reported-new");
    const shown = presentReason("v1", raw);
    expect(shown.verdict).toBe(raw.verdict);
    expect(shown.reason).not.toContain("usually confirmed within days");
    expect(shown.reason).toContain("12 days old");
    expect(shown.reason).toContain("fewer than one in five");
    expect(shown.reason).not.toMatch(/—/);
    expect(evaluateVerdict(ladder, ctx, "v1").reason).toBe(shown.reason);
  });

  it("leaves other v1 reasons and other versions alone", () => {
    const low = evaluateV1(EMPTY_LADDER, { exploitMaturity: "none" });
    expect(presentReason("v1", low)).toEqual(low);
    expect(presentReason("v0", { verdict: "watch", reason: "x" })).toEqual({ verdict: "watch", reason: "x" });
  });
});

describe("v2 wording", () => {
  it("replaces the recency clause for a confirmed, recent flaw without touching the verdict", () => {
    const ladder = { ...EMPTY_LADDER, exploited: "confirmed" as const, attempts: "confirmed" as const };
    const fresh = evaluateVerdict(ladder, { exploitMaturity: "none", daysSincePublished: 0 }, "v2");
    expect(fresh.verdict).toBe("act_now");
    expect(fresh.reason).toBe("Attacks are confirmed. The vulnerability is new today, so almost nothing is patched yet.");
    const older = evaluateVerdict(ladder, { exploitMaturity: "none", daysSincePublished: 207 }, "v2");
    expect(older.reason).toContain("207 days old, so many systems are likely still unpatched.");
    expect(older.reason).not.toContain("current versions are being attacked");
  });

  it("carries the v2 recency correction into v3, which keeps v2's verdicts and sentences", () => {
    expect(wordingVersions("v3")).toEqual(["v3", "v2"]);
    const confirmed = { ...EMPTY_LADDER, exploited: "confirmed" as const, attempts: "confirmed" as const };
    const v2 = evaluateVerdict(confirmed, { exploitMaturity: "none", daysSincePublished: 10 }, "v2");
    const v3 = evaluateVerdict(confirmed, { exploitMaturity: "none", daysSincePublished: 10 }, "v3");
    expect(v2.reason).toContain("many systems are likely still unpatched");
    expect(v3.reason).toBe(v2.reason);
    expect(v3.reason).not.toContain("so current versions are being attacked");
    expect(v3.rulesVersion).toBe("v3");
  });
});
