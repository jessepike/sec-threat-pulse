import { describe, expect, it } from "vitest";
import { EMPTY_LADDER } from "../types";
import { evaluateVerdict } from "./index";
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
    expect(shown.reason).toContain("fewer than half");
    expect(shown.reason).not.toMatch(/—/);
    expect(evaluateVerdict(ladder, ctx, "v1").reason).toBe(shown.reason);
  });

  it("leaves other v1 reasons and other versions alone", () => {
    const low = evaluateV1(EMPTY_LADDER, { exploitMaturity: "none" });
    expect(presentReason("v1", low)).toEqual(low);
    expect(presentReason("v0", { verdict: "watch", reason: "x" })).toEqual({ verdict: "watch", reason: "x" });
  });
});
