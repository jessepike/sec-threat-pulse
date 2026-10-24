// Rules v1. Designed from the Phase 2 backtest (see docs/methodology-rules.md and
// reports/backtest/). Never edit after release: add v2 instead.
//
// One sentence per verdict:
//   Act now: exploitation is confirmed and something makes it urgent, or exploitation is reported
//            for a vulnerability that is 90 days old or newer.
//   Watch:   exploitation is confirmed but the vulnerability is old and nothing adds urgency, or
//            there is a reported attack on an older vulnerability, attack attempts, ready-made
//            tools, three or more proof of concept repositories, reported damage, or a high
//            exploit prediction score.
//   Low:     none of the above.

import type { RulesVersion, VerdictContext, VerdictResult } from "./types";
import type { Ladder } from "../types";
import { isEdgeOrRemoteAccess } from "./v0";

/** Reported exploitation of a CVE this new is treated as Act now. Older reports stay at Watch. */
export const NEW_CVE_DAYS = 90;
/** Confirmed exploitation of a CVE this new is Act now on its own. Older ones need another reason. */
export const CONFIRMED_NEW_CVE_DAYS = 365;
/** This many public proof of concept repositories lift a CVE to Watch. */
export const POC_CROWD_MIN = 3;
export const EPSS_ACT = 0.5;
export const EPSS_WATCH = 0.3;
export const CVSS_CRITICAL = 9;

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function evaluateV1(ladder: Ladder, ctx: VerdictContext): VerdictResult {
  const weaponized = ctx.exploitMaturity === "weaponized";
  const epss = ctx.epss ?? 0;
  const cvss = ctx.cvss ?? 0;
  const edge = isEdgeOrRemoteAccess(ctx.vendor, ctx.product);
  const age = ctx.daysSincePublished;
  const isNew = age !== undefined && age <= NEW_CVE_DAYS;
  const isRecent = age !== undefined && age <= CONFIRMED_NEW_CVE_DAYS;

  if (ladder.exploited === "confirmed") {
    const why: string[] = [];
    if (ctx.kevRansomware) why.push("Ransomware groups are known to use it.");
    if (isRecent) why.push(`The vulnerability is ${age === 0 ? "new today" : `${age} days old`}, so current versions are being attacked.`);
    if (weaponized) why.push("Ready-made attack tools are public.");
    if (edge) why.push("It affects a product that faces the internet or gives remote access.");
    if (cvss >= CVSS_CRITICAL) why.push(`The severity score is critical (${cvss.toFixed(1)}).`);
    if (epss >= EPSS_ACT) why.push(`The exploit prediction score is ${pct(epss)}.`);
    if (why.length) return { verdict: "act_now", reason: `Attacks are confirmed. ${why.join(" ")}` };
    return {
      verdict: "watch",
      reason: "Attacks are confirmed, but the vulnerability is more than a year old and we see no ransomware use, public attack tools, internet-facing product, critical severity or high prediction score. Check whether it applies to you.",
    };
  }

  if (ladder.exploited === "reported") {
    if (isNew) {
      return {
        verdict: "act_now",
        reason: `Attacks are reported and the vulnerability is ${age === 0 ? "new today" : `${age} days old`}. Reports this early are usually confirmed within days.`,
      };
    }
    return { verdict: "watch", reason: "Attacks are reported but not confirmed by an authoritative source, and the vulnerability is more than 90 days old." };
  }

  if (ladder.attempts !== "none") {
    return { verdict: "watch", reason: `Attack attempts are ${ladder.attempts === "confirmed" ? "confirmed" : "reported"}, with no confirmed exploitation yet.` };
  }
  if (ladder.damage !== "none") {
    return { verdict: "watch", reason: `Damage is ${ladder.damage === "confirmed" ? "confirmed" : "reported"}. Check whether it applies to you.` };
  }
  if (weaponized) {
    return { verdict: "watch", reason: "Ready-made attack tools are public, but no attacks are reported yet." };
  }
  if ((ctx.pocRepoCount ?? 0) >= POC_CROWD_MIN) {
    return { verdict: "watch", reason: `${ctx.pocRepoCount} public repositories claim proof of concept code. No attacks are reported yet.` };
  }
  if (epss >= EPSS_WATCH) {
    return { verdict: "watch", reason: `No attacks are reported, but the exploit prediction score is ${pct(epss)}.` };
  }
  return { verdict: "low", reason: "No confirmed or reported attacks, and no sign of widespread exploit tools." };
}

export const rulesV1: RulesVersion = { version: "v1", evaluate: evaluateV1 };
