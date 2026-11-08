// How big would the "Act today" short list have been, day by day? Replays rules v3 over the KEV
// stratum (every CISA KEV addition in the window, fully enumerated) and counts, for each day, the
// CVEs in tier "today" and in Act now at all, for three window lengths. Also reports how long a CVE
// stays in the tier and the score needed to make a top five that day.
//
// Usage: npx tsx scripts/backtest/tier-study.ts [--rules v3] [--from ...] [--to ...] [--reveal-heldout]
// Writes reports/backtest/studies/<rules>-tier-study-<period>.json for each period shown.

import { mkdirSync, writeFileSync } from "node:fs";
import { computeLadder } from "../../src/lib/ladder/compute";
import { getRules } from "../../src/lib/ladder/rules";
import { tierFor } from "../../src/lib/ladder/rules/v3";
import { addDays, dayNumber, dayString, stateAsOf } from "../../src/lib/backtest/replay";
import { median, quantile } from "../../src/lib/backtest/score";
import { cli, hiddenNote, num, setup } from "./common";

const c = cli();
const s = setup({ ...c, flag: (n, d) => c.flag(n, n === "rules" ? "v3" : d) }, "tier-study");
if (!s.revealed) console.log(hiddenNote(s));
const WINDOWS = [14, 21, 30];
const rules = getRules(s.rules);
const kev = s.ds.cves.filter((x) => x.stratum === "kev");

interface PeriodResult {
  period: string;
  days: number;
  /** Daily counts of Act now CVEs in the stratum: median and 90th percentile. */
  actNow: { median?: number; p90?: number; max: number };
  byWindow: Record<string, { median?: number; p90?: number; max: number; daysEmpty: number; daysOverFive: number; everInTier: number; residencyMedian?: number; top5CutoffMedian?: number }>;
}

const results: PeriodResult[] = [];
for (const period of s.periods) {
  // Skip the first 30 days of the whole window: a CVE listed before the dataset starts cannot be seen.
  const first = Math.max(dayNumber(period.from), dayNumber(addDays(s.ds.from, 30)));
  const last = dayNumber(period.to);
  const actDaily: number[] = [];
  const tierDaily: Record<number, number[]> = Object.fromEntries(WINDOWS.map((w) => [w, []]));
  const cutoffDaily: Record<number, number[]> = Object.fromEntries(WINDOWS.map((w) => [w, []]));
  const residency: Record<number, Map<string, number>> = Object.fromEntries(WINDOWS.map((w) => [w, new Map()]));
  for (let n = first; n <= last; n++) {
    const day = dayString(n);
    let act = 0;
    const inTier: Record<number, number[]> = Object.fromEntries(WINDOWS.map((w) => [w, []]));
    for (const cve of kev) {
      if (!cve.kev || cve.kev.dateAdded > day) continue;
      const { observations, ctx } = stateAsOf(cve, day, s.replayOpts);
      const ladder = computeLadder(observations);
      const r = rules.evaluate(ladder, ctx);
      if (r.verdict !== "act_now") continue;
      act++;
      for (const w of WINDOWS) {
        if (tierFor(ladder, ctx, w) !== "today") continue;
        inTier[w].push(r.score ?? 0);
        residency[w].set(cve.cveId, (residency[w].get(cve.cveId) ?? 0) + 1);
      }
    }
    actDaily.push(act);
    for (const w of WINDOWS) {
      tierDaily[w].push(inTier[w].length);
      const sorted = inTier[w].sort((a, b) => b - a);
      if (sorted.length >= 5) cutoffDaily[w].push(sorted[4]);
    }
  }
  const stats = (xs: number[]) => ({ median: median(xs), p90: quantile(xs, 0.9), max: Math.max(0, ...xs) });
  const res: PeriodResult = {
    period: period.name,
    days: last - first + 1,
    actNow: stats(actDaily),
    byWindow: Object.fromEntries(
      WINDOWS.map((w) => [
        String(w),
        {
          ...stats(tierDaily[w]),
          daysEmpty: tierDaily[w].filter((x) => x === 0).length,
          daysOverFive: tierDaily[w].filter((x) => x > 5).length,
          everInTier: residency[w].size,
          residencyMedian: median([...residency[w].values()]),
          top5CutoffMedian: median(cutoffDaily[w]),
        },
      ]),
    ),
  };
  results.push(res);
  console.log(`\nPeriod ${period.name} (${dayString(first)}..${period.to}, ${res.days} days, ${kev.length} KEV additions in the dataset)`);
  console.log(`Act now CVEs per day on the KEV stratum: median ${num(res.actNow.median, 0)}, p90 ${num(res.actNow.p90, 0)}, max ${res.actNow.max}`);
  console.table(
    WINDOWS.map((w) => {
      const r = res.byWindow[String(w)];
      return {
        window: `${w} days`,
        "today per day (median)": num(r.median, 0),
        p90: num(r.p90, 0),
        max: r.max,
        "days with none": r.daysEmpty,
        "days over 5": r.daysOverFive,
        "KEV additions ever in tier": `${r.everInTier}/${kev.filter((x) => x.kev && x.kev.dateAdded >= dayString(first) && x.kev.dateAdded <= period.to).length}`,
        "median days in tier": num(r.residencyMedian, 0),
        "median top-5 cutoff score": num(r.top5CutoffMedian, 0),
      };
    }),
  );
}
mkdirSync("reports/backtest/studies", { recursive: true });
for (const r of results) {
  const file = `reports/backtest/studies/${s.rules}-tier-study-${r.period}.json`;
  writeFileSync(file, JSON.stringify({ rulesVersion: s.rules, ranAt: new Date().toISOString(), dataset: { path: s.dsPath, builtAt: s.ds.builtAt }, windows: WINDOWS, ...r }, null, 2) + "\n");
  console.log(`wrote ${file}`);
}
