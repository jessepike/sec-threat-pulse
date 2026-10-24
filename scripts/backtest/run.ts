// Replays a rules version over the historical dataset and prints the scorecard.
//
// Usage: npm run backtest -- --rules v1 --from 2025-04-01 --to 2026-10-01
//        [--split 2026-04-01] [--dataset path] [--errors 20] [--no-report]
//
// Periods: "tuning" runs from --from to the day before --split, "held-out" from --split to --to.
// A CVE belongs to a period by its KEV listing day, or by its publish day when never listed.

import { join } from "node:path";
import { findDataset, loadDataset, writeJson } from "../../src/lib/backtest/io";
import { replayDataset, firstDayAtLeast, daysBetween } from "../../src/lib/backtest/replay";
import { anchorDay, datasetAnchors, datasetWeights, inPeriod, score, type Period, type Scorecard } from "../../src/lib/backtest/score";
import type { CveReplay } from "../../src/lib/backtest/types";
import { getRules } from "../../src/lib/ladder/rules";

const args = process.argv.slice(2);
const flag = (name: string, dflt?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt;
};
const RULES = flag("rules", "v0")!;
const FROM = flag("from", "2025-04-01")!;
const TO = flag("to", "2026-10-01")!;
const SPLIT = flag("split", "2026-04-01")!;
const ERRORS = Number(flag("errors", "0"));
const WRITE = !args.includes("--no-report");

getRules(RULES);
const dsPath = findDataset(flag("dataset"));
const ds = loadDataset(dsPath);
const from = FROM > ds.from ? FROM : ds.from;
const to = TO < ds.to ? TO : ds.to;

const t0 = Date.now();
const replays = replayDataset(ds, { rulesVersion: RULES, from, to });
const ms = Date.now() - t0;

const periods: Period[] = [
  { name: "all", from, to },
  { name: "tuning", from, to: new Date(Date.parse(SPLIT) - 86400000).toISOString().slice(0, 10) },
  { name: "held-out", from: SPLIT, to },
];
const common = { dataEnd: ds.dataEnd, weights: datasetWeights(ds), anchors: datasetAnchors(ds) };
const cards = periods.map((period) => score(replays, { ...common, period }));

const pct = (x?: number) => (x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x?: number, d = 1) => (x === undefined ? "n/a" : x.toFixed(d));
const row = (label: string, f: (c: Scorecard) => string) => ({ metric: label, ...Object.fromEntries(cards.map((c) => [c.period.name, f(c)])) });

console.log(`Rules ${RULES} on ${dsPath} (${ds.cves.length} CVEs, built ${ds.builtAt.slice(0, 10)}, outcomes through ${ds.dataEnd}); replay ${ms} ms`);
console.log(`Periods: tuning ${periods[1].from}..${periods[1].to}, held-out ${periods[2].from}..${periods[2].to}`);
console.table([
  row("CVEs (kev/signal/random)", (c) => `${c.cves} (${c.byStratum.kev}/${c.byStratum.signal}/${c.byStratum.random})`),
  row("Act now precision, all calls", (c) => `${pct(c.actNow.all.rate)} (${c.actNow.all.hits}/${c.actNow.all.n})`),
  row("Act now precision, calls before confirmation", (c) => `${pct(c.actNow.preConfirmation.rate)} (${c.actNow.preConfirmation.hits}/${c.actNow.preConfirmation.n})`),
  row("Same calls, 90 day horizon", (c) => `${pct(c.actNow.preConfirmation90.rate)} (${c.actNow.preConfirmation90.hits}/${c.actNow.preConfirmation90.n})`),
  row("Act now precision, weighted to population", (c) => `${pct(c.actNow.all.weightedRate)} all, ${pct(c.actNow.preConfirmation.weightedRate)} before confirmation`),
  row("Act now calls after confirmation", (c) => String(c.actNow.postConfirmation)),
  row("Low hold rate (30 days)", (c) => `${pct(c.low.hold.rate)} (${c.low.hold.hits}/${c.low.hold.n})`),
  row("Low hold rate, weighted", (c) => pct(c.low.hold.weightedRate)),
  row("Low hold by stratum kev/signal/random", (c) => `${pct(c.low.byStratum.kev.rate)} / ${pct(c.low.byStratum.signal.rate)} / ${pct(c.low.byStratum.random.rate)}`),
  row("Watch calls confirmed within 90 days", (c) => `${pct(c.watch.hit90.rate)} (${c.watch.hit90.hits}/${c.watch.hit90.n})`),
  row("KEV listings in period", (c) => String(c.leadTime.kevInPeriod)),
  row("Act now ever / on KEV day", (c) => `${pct(c.coverage.rateEver)} / ${pct(c.coverage.rateOnKevDay)}`),
  row("Called Act now before KEV", (c) => `${pct(c.leadTime.shareBeforeKev)} (${c.leadTime.calledBeforeKev})`),
  row("Median lead, all Act now calls (days)", (c) => num(c.leadTime.medianAll)),
  row("Median lead, calls before KEV (days)", (c) => num(c.leadTime.medianPreKev)),
  row("Watch or higher before KEV / median lead", (c) => `${c.leadTime.watchCalledBeforeKev} / ${num(c.leadTime.medianWatchLead)}`),
  row("Transitions per CVE / downgrades", (c) => `${num(c.churn.transitionsPerCve, 2)} / ${c.churn.downgrades}`),
]);
console.log("Confusion (peak verdict before confirmation x outcome), period all:");
console.table(cards[0].confusion);

if (ERRORS > 0) {
  const byId = new Map(ds.cves.map((c) => [c.cveId, c]));
  const show = (title: string, list: CveReplay[]) => {
    console.log(`\n${title}: ${list.length}`);
    for (const r of list.slice(0, ERRORS)) {
      const c = byId.get(r.cveId)!;
      const d0 = firstDayAtLeast(r, "act_now");
      console.log(`  ${r.cveId} ${c.stratum} cvss=${c.cvss ?? "?"} ${c.vendor ?? ""} ${c.product ?? ""} | kev=${c.kev?.dateAdded ?? "-"} confirmed=${r.confirmedAt ?? "-"} (${r.confirmedBy ?? "-"}) act=${d0 ?? "-"} | msf=${c.metasploit.length} nuclei=${c.nuclei ?? "-"} poc=${c.pocGithub.length} edb=${c.exploitdb.length} ssvc=${JSON.stringify(c.ssvc ?? {})} circl=${c.circl.map((s) => `${s.type}:${s.sourceKind}@${s.date}`).slice(0, 4).join(",")} epssMax=${Math.max(0, ...c.epss.map((p) => p[1]))}`);
      console.log(`    ${r.transitions.map((t) => `${t.day} ${t.verdict}`).join(" -> ")}`);
    }
  };
  const inAll = replays.filter((r) => inPeriod(anchorDay(r, common.anchors[r.cveId]), periods[0]));
  show(
    "False Act now (called, no confirmation within 30 days)",
    inAll.filter((r) => {
      const d0 = firstDayAtLeast(r, "act_now");
      return d0 && !(r.confirmedAt && daysBetween(d0, r.confirmedAt) <= 30);
    }),
  );
  show(
    "Missed (Low within 30 days before confirmation)",
    inAll.filter((r) => cards[0].low.missed.includes(r.cveId)),
  );
  show(
    "KEV listed but never Act now",
    inAll.filter((r) => r.kevDate && inPeriod(r.kevDate, periods[0]) && !firstDayAtLeast(r, "act_now")),
  );
}

if (WRITE) {
  const path = join("reports", "backtest", `${RULES}-${from}-${to}.json`);
  writeJson(path, {
    rulesVersion: RULES,
    dataset: { path: dsPath, builtAt: ds.builtAt, dataEnd: ds.dataEnd, cves: ds.cves.length, sampling: ds.sampling, sources: ds.sources },
    window: { from, to, split: SPLIT },
    ranAt: new Date().toISOString(),
    scorecards: cards.map((c) => ({ ...c, low: { ...c.low, missed: c.low.missed.slice(0, 200) }, leadTime: { ...c.leadTime, leads: c.leadTime.leads.sort((a, b) => a - b) } })),
  });
  console.log(`\nReport written to ${path}`);
}
