import type { Ladder } from "../types";
import { rulesV0 } from "./v0";
import { rulesV1 } from "./v1";
import { rulesV2 } from "./v2";
import { rulesV3 } from "./v3";
import { presentReason } from "./reasons";
import type { RulesVersion, VerdictContext, VerdictResult } from "./types";

export type { ActTier, RulesVersion, VerdictContext, VerdictResult } from "./types";

/** Add new versions here. Never edit an old one: the backtest replays them. */
export const RULES: Record<string, RulesVersion> = {
  v0: rulesV0,
  v1: rulesV1,
  v2: rulesV2,
  /** v2 verdicts plus the Act today tier and a ranking score. Active since Nov 8, 2026. */
  v3: rulesV3,
};

export const CURRENT_RULES_VERSION = "v3";

export function getRules(version: string = CURRENT_RULES_VERSION): RulesVersion {
  const r = RULES[version];
  if (!r) throw new Error(`Unknown rules version: ${version}`);
  return r;
}

/**
 * The versions whose reader-facing wording applies to a result: the version itself, then the
 * version whose verdicts it keeps (`verdictsFrom`), and so on. A version that only adds a tier
 * or a score writes the same sentences as its base, so the base's wording fixes still apply.
 */
export function wordingVersions(version: string): string[] {
  const out = [version];
  let next = RULES[version]?.verdictsFrom;
  while (next && !out.includes(next)) {
    out.push(next);
    next = RULES[next]?.verdictsFrom;
  }
  return out;
}

/** Evaluate and apply reader-facing wording (reasons.ts). The backtest calls the version's evaluate directly. */
export function evaluateVerdict(ladder: Ladder, ctx: VerdictContext, version: string = CURRENT_RULES_VERSION): VerdictResult & { rulesVersion: string } {
  let result = getRules(version).evaluate(ladder, ctx);
  for (const v of wordingVersions(version)) result = presentReason(v, result);
  return { ...result, rulesVersion: version };
}
