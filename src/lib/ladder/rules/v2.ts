// Rules v2. Designed Oct 2026 from the corrected backtest (docs/methodology-rules.md,
// reports/backtest/). Never edit after release: add v3 instead.
//
// Same shape as v1 with two changes:
//   - A single unconfirmed report of exploitation no longer lifts a new CVE to Act now. It needs
//     a second separate report, or confirmed attack attempts (honeypot telemetry) beside it.
//     On the tuning period one report alone was right 7 times in 165; two or more were right
//     about half the time. The review also found keyword noise in single Telegram posts.
//   - Every result carries a ruleId, and the reason text says what the backtest found instead of
//     promising that early reports are usually confirmed.
//
// One sentence per verdict:
//   Act now: exploitation is confirmed and something makes it urgent, or exploitation of a CVE 90
//            days old or newer is reported twice, or reported once with confirmed attack attempts.
//   Watch:   confirmed exploitation of an old CVE with nothing adding urgency, a single report, a
//            report on an older CVE, attack attempts, ready-made tools, three or more proof of
//            concept repositories, reported damage, or a high prediction score.
//   Low:     none of the above.

import type { RulesVersion, VerdictContext, VerdictResult } from "./types";
import type { Ladder } from "../types";
import { isEdgeOrRemoteAccess } from "./v0";

export const NEW_CVE_DAYS = 90;
export const CONFIRMED_NEW_CVE_DAYS = 365;
export const POC_CROWD_MIN = 3;
export const EPSS_ACT = 0.5;
export const EPSS_WATCH = 0.3;
export const CVSS_CRITICAL = 9;
/** Separate exploitation reports needed before a new CVE is Act now without confirmation. */
export const REPORTS_FOR_ACT = 2;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ageText = (age: number) => (age === 0 ? "new today" : `${age} days old`);

/** Number of separate unconfirmed exploitation reports. Unknown (older callers) counts as one. */
export function reportCount(ctx: VerdictContext): number {
  return ctx.reportedExploitationSources === undefined ? 1 : ctx.reportedExploitationSources.length;
}

/** A second report, or honeypot telemetry showing attempts, backs a single report. */
export function corroborated(ladder: Ladder, ctx: VerdictContext): boolean {
  return reportCount(ctx) >= REPORTS_FOR_ACT || ladder.attempts === "confirmed";
}

export function evaluateV2(ladder: Ladder, ctx: VerdictContext): VerdictResult {
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
    if (isRecent) why.push(`The vulnerability is ${ageText(age)}, so current versions are being attacked.`);
    if (weaponized) why.push("Ready-made attack tools are public.");
    if (edge) why.push("It affects a product that faces the internet or gives remote access.");
    if (cvss >= CVSS_CRITICAL) why.push(`The severity score is critical (${cvss.toFixed(1)}).`);
    if (epss >= EPSS_ACT) why.push(`The exploit prediction score is ${pct(epss)}.`);
    if (why.length) return { verdict: "act_now", ruleId: "confirmed-urgent", reason: `Attacks are confirmed. ${why.join(" ")}` };
    return {
      verdict: "watch",
      ruleId: "confirmed-old",
      reason: "Attacks are confirmed, but the vulnerability is more than a year old and we see no ransomware use, public attack tools, internet-facing product, critical severity or high prediction score. Check whether it applies to you.",
    };
  }

  if (ladder.exploited === "reported") {
    if (isNew) {
      if (!corroborated(ladder, ctx)) {
        return {
          verdict: "watch",
          ruleId: "reported-new-single",
          reason: `One source reports attacks and the vulnerability is ${ageText(age)}. In our backtest a single early report was confirmed within 30 days about one time in twenty, so we wait for a second report or for attack attempts to be seen.`,
        };
      }
      const backing = reportCount(ctx) >= REPORTS_FOR_ACT ? `${reportCount(ctx)} separate sources report attacks` : "Attacks are reported and honeypots see attempts";
      return {
        verdict: "act_now",
        ruleId: "reported-new",
        reason: `${backing}, and the vulnerability is ${ageText(age)}. No authoritative source has confirmed the attacks yet. In our backtest about half of calls like this were confirmed within 30 days, so check whether the product applies to you first.`,
      };
    }
    return { verdict: "watch", ruleId: "reported-old", reason: "Attacks are reported but not confirmed by an authoritative source, and the vulnerability is more than 90 days old." };
  }

  if (ladder.attempts !== "none") {
    return { verdict: "watch", ruleId: "attempts", reason: `Attack attempts are ${ladder.attempts === "confirmed" ? "confirmed" : "reported"}, with no confirmed exploitation yet.` };
  }
  if (ladder.damage !== "none") {
    return { verdict: "watch", ruleId: "damage", reason: `Damage is ${ladder.damage === "confirmed" ? "confirmed" : "reported"}. Check whether it applies to you.` };
  }
  if (weaponized) {
    return { verdict: "watch", ruleId: "tools", reason: "Ready-made attack tools are public, but no attacks are reported yet." };
  }
  if ((ctx.pocRepoCount ?? 0) >= POC_CROWD_MIN) {
    return { verdict: "watch", ruleId: "poc-crowd", reason: `${ctx.pocRepoCount} public repositories claim proof of concept code. No attacks are reported yet.` };
  }
  if (epss >= EPSS_WATCH) {
    return { verdict: "watch", ruleId: "epss", reason: `No attacks are reported, but the exploit prediction score is ${pct(epss)}.` };
  }
  return { verdict: "low", ruleId: "low", reason: "No confirmed or reported attacks, and no sign of widespread exploit tools." };
}

export const rulesV2: RulesVersion = { version: "v2", evaluate: evaluateV2 };
