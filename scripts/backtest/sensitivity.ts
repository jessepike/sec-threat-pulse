// Sensitivity views for one rules version: the default replay beside the optimistic and the
// alternative measurements the Oct 2026 review asked to see. Same flags as run.ts.
//
// Usage: npx tsx scripts/backtest/sensitivity.ts --rules v1 [--reveal-heldout]
//
// Rows:
//   default              CIRCL lag 1 day, truth = KEV, VulnCheck KEV, vendor confirmation
//   circl lag 0          sightings seen on their creation day (timestamps can be backfilled)
//   truth + circl        two independent CIRCL reports also count as confirmation (secondary view)
//   kev catalog counted  the old production mapping, before catalog mirrors were dropped
//   truth + circl, lag 0 both optimistic switches at once

import type { ReplayOptions } from "../../src/lib/backtest/replay";
import type { Scorecard } from "../../src/lib/backtest/score";
import { cli, hiddenNote, run, sampledCell, setup, weightedCell } from "./common";

const c = cli();
const s = setup(c, "sensitivity");
if (!s.revealed) console.log(hiddenNote(s));

const variants: [string, Partial<ReplayOptions>][] = [
  ["default", {}],
  ["circl lag 0", { circlLagDays: 0 }],
  ["truth + circl reports", { truth: "circl" }],
  ["kev catalog sightings counted", { includeKevCatalogSightings: true }],
  ["truth + circl reports, lag 0", { truth: "circl", circlLagDays: 0 }],
];

const metrics: [string, (c: Scorecard) => string][] = [
  ["Act now before confirmation, 30 days", (c) => weightedCell(c.actNow.preConfirmation)],
  ["Same, 90 days", (c) => weightedCell(c.actNow.preConfirmation90)],
  ["Watch confirmed within 90 days", (c) => weightedCell(c.watch.hit90)],
  ["Low hold, KEV stratum", (c) => sampledCell(c.low.byStratum.kev)],
  ["KEV additions with pre-listing Act now", (c) => sampledCell(c.leadTime.shareBeforeKev)],
  ["Median lead of those calls", (c) => (c.leadTime.medianPreKev === undefined ? "n/a" : `${c.leadTime.medianPreKev} days`)],
  ["Act now all calls (secondary)", (c) => weightedCell(c.actNow.all)],
];

console.log(`Rules ${s.rules}, window ${s.from}..${s.to}, split ${s.split}`);
for (const period of s.periods) {
  console.log(`\nPeriod ${period.name} (${period.from}..${period.to}):`);
  const rows: Record<string, string>[] = [];
  const cards = variants.map(([name, opts]) => [name, run({ ...s, periods: [period] }, opts).cards[0]] as const);
  for (const [label, f] of metrics) rows.push({ metric: label, ...Object.fromEntries(cards.map(([name, card]) => [name, f(card)])) });
  console.table(rows);
}
