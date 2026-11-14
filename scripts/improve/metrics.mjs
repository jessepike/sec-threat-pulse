// The improve loop's metrics and its keep-or-discard rule. Pure: no network, no files, so it is unit
// tested (src/lib/improve/metrics.test.ts). A protected file: the loop may read it, never change it
// without the tier 2 review panel (docs/improve/program.md).
//
// A scorecard is { at, rulesVersion, metrics: { [id]: number | null } }. Each metric id below says
// which way is better and how big a move counts as more than noise.

/** @typedef {{ label: string, better: "up" | "down", noise: number, lane: string }} MetricDef */

/** @type {Record<string, MetricDef>} */
export const METRICS = {
  // Backtest, tuning period only, for the active rules version (scripts/improve/scorecard.ts).
  "bt.earlyActNowRight30": { label: "Early Act now right within 30 days (tuning, weighted)", better: "up", noise: 0.02, lane: "accuracy" },
  "bt.kevCalledBeforeShare": { label: "KEV additions with an Act now before listing (tuning)", better: "up", noise: 0.01, lane: "accuracy" },
  "bt.medianLeadDays": { label: "Median lead of those calls, days (tuning)", better: "up", noise: 1, lane: "accuracy" },
  "bt.watchHit90": { label: "Watch confirmed within 90 days (tuning, weighted)", better: "up", noise: 0.02, lane: "accuracy" },
  "bt.lowHoldKev": { label: "Low hold, KEV stratum, 30 days (tuning)", better: "up", noise: 0.03, lane: "accuracy" },
  "bt.kevActNowOnListingDay": { label: "KEV additions Act now on listing day (tuning)", better: "up", noise: 0.01, lane: "accuracy" },
  "bt.transitionsPerCve": { label: "Verdict changes per CVE (tuning)", better: "down", noise: 0.05, lane: "accuracy" },
  // The repo (scripts/improve/scorecard.ts).
  "repo.sources": { label: "Sources in the registry", better: "up", noise: 0, lane: "coverage" },
  "repo.keylessSources": { label: "Sources that need no key", better: "up", noise: 0, lane: "coverage" },
  "repo.untrackedRungs": { label: "Ladder rungs with no source (vulnerability events)", better: "down", noise: 0, lane: "coverage" },
  // The live site (scripts/improve/live-scorecard.mjs, nightly on the data branch).
  "live.sourcesOk": { label: "Sources reporting ok", better: "up", noise: 0, lane: "coverage" },
  "live.agentTestsPassRate": { label: "Agent test set pass rate", better: "up", noise: 0, lane: "agents" },
  "live.actNowRate": { label: "Live early Act now right (settled calls)", better: "up", noise: 0.05, lane: "accuracy" },
  "live.kevCalledBeforeShare": { label: "Live KEV listings called before listing", better: "up", noise: 0.05, lane: "accuracy" },
  "live.earlyActNowShare": { label: "Act now events not yet in KEV (share of Act now)", better: "up", noise: 0.03, lane: "coverage" },
};

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/**
 * Signed improvement of one metric: positive is better, in the metric's own units.
 * @returns {number | null} null when either side is missing
 */
export function gain(id, before, after) {
  const def = METRICS[id];
  if (!def || !isNum(before) || !isNum(after)) return null;
  return def.better === "up" ? after - before : before - after;
}

/**
 * The keep rule. Keep only when the target metric improves by more than its noise and no other
 * metric gets worse by more than its noise. A target of "none" (a docs or fix change with no
 * metric of its own) keeps when nothing regresses.
 *
 * @param {{ metrics: Record<string, number | null> }} before
 * @param {{ metrics: Record<string, number | null> }} after
 * @param {string} target  a metric id, or "none"
 * @returns {{ keep: boolean, reasons: string[], target: { id: string, before: number | null, after: number | null, gain: number | null } | null, regressions: { id: string, before: number, after: number | null, gain: number | null }[] }}
 */
export function judge(before, after, target) {
  const reasons = [];
  const regressions = [];
  for (const id of Object.keys(METRICS)) {
    if (id === target) continue;
    const b = before.metrics?.[id];
    const a = after.metrics?.[id];
    // A guardrail that was measurable and is no longer cannot be shown not to have regressed.
    if (isNum(b) && !isNum(a)) {
      reasons.push(`${id} was ${b} and is now missing, so it cannot be shown not to regress`);
      regressions.push({ id, before: b, after: null, gain: null });
      continue;
    }
    const g = gain(id, b, a);
    if (g !== null && g < -METRICS[id].noise) regressions.push({ id, before: before.metrics[id], after: after.metrics[id], gain: g });
  }
  for (const r of regressions) if (r.gain !== null) reasons.push(`${r.id} got worse: ${r.before} to ${r.after} (noise band ${METRICS[r.id].noise})`);

  let t = null;
  let targetOk = true;
  if (target !== "none") {
    if (!METRICS[target]) {
      return { keep: false, reasons: [`unknown target metric ${target}`], target: null, regressions };
    }
    const b = before.metrics?.[target] ?? null;
    const a = after.metrics?.[target] ?? null;
    const g = gain(target, b, a);
    t = { id: target, before: b, after: a, gain: g };
    if (g === null) {
      targetOk = false;
      reasons.push(`${target} is missing from ${b === null ? "the before" : "the after"} scorecard`);
    } else if (g <= METRICS[target].noise) {
      targetOk = false;
      reasons.push(`${target} did not move past its noise band: ${b} to ${a} (needs more than ${METRICS[target].noise})`);
    } else {
      reasons.push(`${target} improved: ${b} to ${a}`);
    }
  }
  return { keep: targetOk && regressions.length === 0, reasons, target: t, regressions };
}
