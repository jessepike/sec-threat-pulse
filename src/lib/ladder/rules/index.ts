import type { Ladder } from "../types";
import { rulesV0 } from "./v0";
import type { RulesVersion, VerdictContext, VerdictResult } from "./types";

export type { RulesVersion, VerdictContext, VerdictResult } from "./types";

/** Add new versions here. Never edit an old one: the backtest replays them. */
export const RULES: Record<string, RulesVersion> = {
  v0: rulesV0,
};

export const CURRENT_RULES_VERSION = "v0";

export function getRules(version: string = CURRENT_RULES_VERSION): RulesVersion {
  const r = RULES[version];
  if (!r) throw new Error(`Unknown rules version: ${version}`);
  return r;
}

export function evaluateVerdict(ladder: Ladder, ctx: VerdictContext, version: string = CURRENT_RULES_VERSION): VerdictResult & { rulesVersion: string } {
  return { ...getRules(version).evaluate(ladder, ctx), rulesVersion: version };
}
