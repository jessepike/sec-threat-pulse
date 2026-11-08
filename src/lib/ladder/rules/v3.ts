// Rules v3. Drafted Nov 8, 2026 for the home page short list ("Act today") and a published
// ranking inside each verdict. Verdicts are v2's, unchanged: v3 only adds a tier and a score.
// Not active until the owner approves it (CURRENT_RULES_VERSION in index.ts).
// Never edit after release: add v4 instead.
//
// Why: on Nov 7, 2026 75 of 112 events were Act now, so the verdict no longer sorted attention.
// Practitioners rank the same way every time: active exploitation first, then exposure, then
// likelihood and severity (docs/plan/value-brief.md, finding 3). The tier and the score write that
// order down so the top 3 to 5 is computable, and the same for everyone.
//
// Act today (tier inside Act now): exploitation confirmed by an authoritative source within the
// last TODAY_WINDOW_DAYS, and at least one of: the product faces the internet or gives remote access, ransomware use is flagged,
// ready-made attack tools are public. Everything else that is Act now is tier "now".
//
// Score (0 to 11), additive, one line per factor:
//   +3 exploitation confirmed, or +1 reported
//   +2 internet-facing or remote-access product (category table, or the v0 edge patterns)
//   +2 ransomware use flagged by CISA
//   +1 ready-made attack tools public
//   +2 confirmed (or first reported) within 7 days, +1 within 21 days
//   +1 affects three or more products, or a component other products ship
// Ties are broken by the caller (newest evidence first, then id).
//
// The window comes from scripts/backtest/tier-study.ts on the tuning period (May 2025 to Mar 2026,
// every KEV addition): with 14 days the tier held a median of 5 CVEs a day (90th percentile 8),
// with 21 days 7 (11), with 30 days 10 (16). Events group CVEs, so event counts run lower.

import type { RulesVersion, VerdictContext, VerdictResult, ActTier } from "./types";
import type { Ladder } from "../types";
import { isEdgeOrRemoteAccess } from "./v0";
import { evaluateV2 } from "./v2";

export const TODAY_WINDOW_DAYS = 14;
export const FRESH_DAYS = 7;
export const RECENT_DAYS = 21;
export const BREADTH_MIN_PRODUCTS = 3;

/** Categories whose systems face the internet or control access, from lib/ladder/category. */
export const EXPOSED_CATEGORIES: ReadonlySet<string> = new Set(["edge", "remote-it", "file-transfer", "email", "identity"]);

export function isExposed(ctx: VerdictContext): boolean {
  if (ctx.categoryId && EXPOSED_CATEGORIES.has(ctx.categoryId)) return true;
  return isEdgeOrRemoteAccess(ctx.vendor, ctx.product);
}

/** Days since the strongest dated signal: confirmation when it exists, else the first report. */
export function daysSinceSignal(ladder: Ladder, ctx: VerdictContext): number | undefined {
  if (ladder.exploited === "confirmed" && ctx.daysSinceConfirmed !== undefined) return ctx.daysSinceConfirmed;
  return ctx.daysSinceFirstReport;
}

/** The tier for an Act now verdict. `windowDays` exists for the backtest study; production uses the default. */
export function tierFor(ladder: Ladder, ctx: VerdictContext, windowDays = TODAY_WINDOW_DAYS): ActTier {
  const confirmedRecently = ladder.exploited === "confirmed" && ctx.daysSinceConfirmed !== undefined && ctx.daysSinceConfirmed <= windowDays;
  const amplified = isExposed(ctx) || ctx.kevRansomware === true || ctx.exploitMaturity === "weaponized";
  return confirmedRecently && amplified ? "today" : "now";
}

export function scoreFor(ladder: Ladder, ctx: VerdictContext): { score: number; why: string[] } {
  const parts: [number, string][] = [];
  if (ladder.exploited === "confirmed") parts.push([3, "Exploitation is confirmed by an authoritative source."]);
  else if (ladder.exploited === "reported") parts.push([1, "Exploitation is reported."]);
  if (isExposed(ctx)) parts.push([2, "The product faces the internet or gives remote access."]);
  if (ctx.kevRansomware) parts.push([2, "Ransomware groups are known to use it."]);
  if (ctx.exploitMaturity === "weaponized") parts.push([1, "Ready-made attack tools are public."]);
  const days = daysSinceSignal(ladder, ctx);
  const what = ladder.exploited === "confirmed" ? "confirmation" : "first report";
  const ageText = (n: number) => (n === 0 ? "from today" : n === 1 ? "1 day old" : `${n} days old`);
  if (days !== undefined && days <= FRESH_DAYS) parts.push([2, `The ${what} is ${ageText(days)}.`]);
  else if (days !== undefined && days <= RECENT_DAYS) parts.push([1, `The ${what} is ${ageText(days)}.`]);
  if ((ctx.affectedProductCount ?? 0) >= BREADTH_MIN_PRODUCTS || ctx.embedsComponent) parts.push([1, ctx.embedsComponent ? "Other products ship the affected component." : `${ctx.affectedProductCount} products are affected.`]);
  return { score: parts.reduce((a, [n]) => a + n, 0), why: parts.map(([, w]) => w) };
}

export function evaluateV3(ladder: Ladder, ctx: VerdictContext): VerdictResult {
  const base = evaluateV2(ladder, ctx);
  const { score, why } = scoreFor(ladder, ctx);
  return { ...base, score, scoreWhy: why, ...(base.verdict === "act_now" ? { tier: tierFor(ladder, ctx) } : {}) };
}

export const rulesV3: RulesVersion = { version: "v3", evaluate: evaluateV3 };
