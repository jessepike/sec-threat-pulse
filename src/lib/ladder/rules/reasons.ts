// Reader-facing wording for verdict reasons, kept apart from the rule logic.
//
// Rule versions are frozen once released because the backtest replays them. Their verdicts must
// not change, but the sentence shown to a reader can be wrong on the evidence and still need
// fixing. This map holds those fixes. evaluateVerdict applies it; the backtest replay does not,
// so replayed reasons stay as the version wrote them.
//
// v0 and v1 return no ruleId, so for them the rule is recognised from the sentence it wrote.
// Versions from v2 on return a ruleId and are keyed by it.

import type { VerdictResult } from "./types";

type Override = (r: VerdictResult) => string | undefined;

/** v1 rule 3: reported exploitation on a CVE 90 days old or newer. */
const V1_REPORTED_NEW = /^Attacks are reported and the vulnerability is (new today|\d+ days old)\. Reports this early are usually confirmed within days\.$/;

const OVERRIDES: Record<string, Override[]> = {
  v1: [
    (r) => {
      const m = r.reason.match(V1_REPORTED_NEW);
      if (!m) return undefined;
      // The backtest contradicts the old sentence: in the corrected replay, fewer than half of these
      // calls were followed by a CISA KEV listing within 30 days. Say so.
      return `Attacks are reported and the vulnerability is ${m[1]}. No authoritative source has confirmed the attacks yet. In our backtest fewer than half of reports this early were confirmed within 30 days, so check whether the product applies to you before you spend effort.`;
    },
  ],
};

/** Stable rule id for a v1 result, derived from its wording. Used by audits and tests. */
export function inferRuleIdV1(r: VerdictResult): string | undefined {
  if (V1_REPORTED_NEW.test(r.reason)) return "reported-new";
  return undefined;
}

/** The result with reader-facing wording applied. Verdict and ruleId are never changed. */
export function presentReason(version: string, r: VerdictResult): VerdictResult {
  for (const o of OVERRIDES[version] ?? []) {
    const reason = o(r);
    if (reason) return { ...r, reason };
  }
  return r;
}
