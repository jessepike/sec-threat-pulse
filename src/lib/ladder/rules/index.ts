import type { Ladder } from "../types";
import { rulesV0 } from "./v0";
import { rulesV1 } from "./v1";
import { presentReason } from "./reasons";
import type { RulesVersion, VerdictContext, VerdictResult } from "./types";

export type { RulesVersion, VerdictContext, VerdictResult } from "./types";

/** Add new versions here. Never edit an old one: the backtest replays them. */
export const RULES: Record<string, RulesVersion> = {
  v0: rulesV0,
  v1: rulesV1,
};

export const CURRENT_RULES_VERSION = "v1";

export function getRules(version: string = CURRENT_RULES_VERSION): RulesVersion {
  const r = RULES[version];
  if (!r) throw new Error(`Unknown rules version: ${version}`);
  return r;
}

/** Evaluate and apply reader-facing wording (reasons.ts). The backtest calls the version's evaluate directly. */
export function evaluateVerdict(ladder: Ladder, ctx: VerdictContext, version: string = CURRENT_RULES_VERSION): VerdictResult & { rulesVersion: string } {
  return { ...presentReason(version, getRules(version).evaluate(ladder, ctx)), rulesVersion: version };
}
