// Replays a rules version over the historical dataset and prints the scorecard.
//
// Usage: npm run backtest -- --rules v1 [--from 2025-04-01] [--to 2026-10-01] [--split 2026-04-01]
//        [--dataset path] [--errors 20] [--circl-lag 1] [--truth catalog|circl]
//        [--kev-catalog-sightings] [--reveal-heldout] [--no-report]
//
// Periods: "tuning" runs from --from to the day before --split, "held-out" from --split to --to.
// Each call is placed in a period by the day it was made. Held-out (and whole window) results are
// hidden unless --reveal-heldout is passed; every reveal is logged to
// reports/backtest/heldout-reveals.log. The report file is written only on a reveal.
//
// The headline figures are population weighted with 95% Wilson intervals (effective sample size
// for the weighted ones). "All calls" precision and KEV coverage are secondary: most Act now
// calls come on or after the KEV listing and count as hits by construction.

import { join } from "node:path";
import { writeJson } from "../../src/lib/backtest/io";
import { firstDayAtLeast, daysBetween } from "../../src/lib/backtest/replay";
import { inPeriod, type Scorecard } from "../../src/lib/backtest/score";
import type { CveReplay } from "../../src/lib/backtest/types";
import { cli, hiddenNote, num, pct, rateCi, run, sampledCell, setup, weightedCell } from "./common";

const c = cli();
const s = setup(c, "run");
const ERRORS = Number(c.flag("errors", "0"));
const WRITE = !c.has("no-report");
const { replays, cards, ms } = run(s);

const row = (label: string, f: (c: Scorecard) => string) => ({ metric: label, ...Object.fromEntries(cards.map((c) => [c.period.name, f(c)])) });
const lead = (c: Scorecard) => (c.leadTime.medianPreKev === undefined ? "n/a" : `${num(c.leadTime.medianPreKev)} days (p25 ${num(c.leadTime.p25PreKev, 0)}, p75 ${num(c.leadTime.p75PreKev, 0)})`);

console.log(`Rules ${s.rules} on ${s.dsPath} (${s.ds.cves.length} CVEs, built ${s.ds.builtAt.slice(0, 10)}, outcomes through ${s.ds.dataEnd}); replay ${ms} ms`);
console.log(`Window ${s.from}..${s.to}, split ${s.split}; CIRCL lag ${s.replayOpts.circlLagDays} day(s); truth ${s.replayOpts.truth}${s.replayOpts.includeKevCatalogSightings ? "; KEV catalog sightings counted (old production mapping)" : ""}`);
if (!s.revealed) console.log(hiddenNote(s));

console.log("\nHeadline (population weighted, 95% interval, then sampled hits/calls):");
console.table([
  row("CVEs replayed (kev/reported/signal/random)", (c) => `${c.cves} (${c.byStratum.kev}/${c.byStratum.reported}/${c.byStratum.signal}/${c.byStratum.random})`),
  row("Act now before confirmation, right within 30 days", (c) => weightedCell(c.actNow.preConfirmation)),
  row("Same calls, right within 90 days", (c) => weightedCell(c.actNow.preConfirmation90)),
  row("Watch, confirmed within 90 days", (c) => weightedCell(c.watch.hit90)),
  row("Low hold, KEV stratum (30 days)", (c) => sampledCell(c.low.byStratum.kev)),
  row("  always-Low baseline, KEV stratum", (c) => sampledCell(c.low.alwaysLowByStratum.kev)),
  row("Low hold, weighted (30 days)", (c) => weightedCell(c.low.hold)),
  row("  always-Low baseline, weighted", (c) => weightedCell(c.low.alwaysLow)),
  row("KEV additions with an Act now before listing", (c) => sampledCell(c.leadTime.shareBeforeKev)),
  row("  median lead of those calls", lead),
]);

console.log("Secondary (partly true by construction: calls on or after the listing day count as hits, and coverage follows from rule 1):");
console.table([
  row("Act now precision, all calls (weighted)", (c) => weightedCell(c.actNow.all)),
  row("  of which calls on or after confirmation", (c) => String(c.actNow.postConfirmation)),
  row("Act now before confirmation, sampled by stratum kev/reported/signal/random", (c) => ["kev", "reported", "signal", "random"].map((k) => `${pct(c.actNow.preByStratum[k as keyof typeof c.actNow.preByStratum].rate)} (${c.actNow.preByStratum[k as keyof typeof c.actNow.preByStratum].n})`).join(" / ")),
  row("KEV additions Act now on listing day", (c) => rateCi(c.coverage.rateOnKevDay.rate, c.coverage.rateOnKevDay.ci)),
  row("KEV additions Act now ever", (c) => rateCi(c.coverage.rateEver.rate, c.coverage.rateEver.ci)),
  row("Median lead, all Act now calls on KEV additions", (c) => `${num(c.leadTime.medianAll)} days`),
  row("Watch or higher before KEV / median lead", (c) => `${c.leadTime.watchCalledBeforeKev} / ${num(c.leadTime.medianWatchLead)}`),
  row("Transitions per CVE / downgrades", (c) => `${num(c.churn.transitionsPerCve, 2)} / ${c.churn.downgrades}`),
  row("Unscoreable Act now calls (under 30 days of follow-up)", (c) => String(c.actNow.unscoreable)),
  row("Left censored first day calls on pre-window CVEs (not scored)", (c) => String(c.actNow.leftCensored)),
]);
const last = cards[cards.length - 1];
console.log(`Confusion (peak verdict before confirmation x outcome), period ${last.period.name}:`);
console.table(last.confusion);

if (ERRORS > 0) {
  const byId = new Map(s.ds.cves.map((c) => [c.cveId, c]));
  const period = cards[0].period;
  const show = (title: string, list: CveReplay[]) => {
    console.log(`\n${title} (${period.name}): ${list.length}`);
    for (const r of list.slice(0, ERRORS)) {
      const cve = byId.get(r.cveId)!;
      const d0 = firstDayAtLeast(r, "act_now");
      console.log(`  ${r.cveId} ${cve.stratum} cvss=${cve.cvss ?? "?"} ${cve.vendor ?? ""} ${cve.product ?? ""} | kev=${cve.kev?.dateAdded ?? "-"} confirmed=${r.confirmedAt ?? "-"} (${r.confirmedBy ?? "-"}) act=${d0 ?? "-"} | msf=${cve.metasploit.length} nuclei=${cve.nuclei ?? "-"} poc=${cve.pocGithub.length} edb=${cve.exploitdb.length} ssvc=${JSON.stringify(cve.ssvc ?? {})} circl=${cve.circl.map((x) => `${x.type}:${x.sourceKind}@${x.date}`).slice(0, 4).join(",")} epssMax=${Math.max(0, ...cve.epss.map((p) => p[1]))}`);
      console.log(`    ${r.transitions.map((t) => `${t.day} ${t.verdict}`).join(" -> ")}`);
    }
  };
  show(
    "False Act now (called before confirmation, none within 30 days)",
    replays.filter((r) => {
      const d0 = firstDayAtLeast(r, "act_now");
      return d0 && inPeriod(d0, period) && !(r.confirmedAt && r.confirmedAt <= d0) && !(r.confirmedAt && daysBetween(d0, r.confirmedAt) <= 30);
    }),
  );
  show("Missed (Low within 30 days before confirmation)", replays.filter((r) => cards[0].low.missed.includes(r.cveId)));
  show("KEV listed but never Act now", replays.filter((r) => r.kevDate && inPeriod(r.kevDate, period) && !firstDayAtLeast(r, "act_now")));
}

if (WRITE && s.revealed) {
  const variant = [s.replayOpts.circlLagDays !== 1 ? `lag${s.replayOpts.circlLagDays}` : "", s.replayOpts.truth !== "catalog" ? `truth-${s.replayOpts.truth}` : "", s.replayOpts.includeKevCatalogSightings ? "kevcat" : ""].filter(Boolean).join("-");
  const path = join("reports", "backtest", `${s.rules}-${s.from}-${s.to}${variant ? `-${variant}` : ""}.json`);
  writeJson(path, {
    rulesVersion: s.rules,
    dataset: { path: s.dsPath, builtAt: s.ds.builtAt, dataEnd: s.ds.dataEnd, cves: s.ds.cves.length, sampling: s.ds.sampling, sources: s.ds.sources },
    window: { from: s.from, to: s.to, split: s.split },
    replay: { circlLagDays: s.replayOpts.circlLagDays, truth: s.replayOpts.truth, includeKevCatalogSightings: !!s.replayOpts.includeKevCatalogSightings },
    ranAt: new Date().toISOString(),
    scorecards: cards.map((c) => ({ ...c, low: { ...c.low, missed: c.low.missed.slice(0, 200) }, leadTime: { ...c.leadTime, leads: [...c.leadTime.leads].sort((a, b) => a - b) } })),
  });
  console.log(`\nReport written to ${path}`);
} else if (WRITE) {
  console.log("\nNo report written: reports include held-out results, so they need --reveal-heldout.");
}
