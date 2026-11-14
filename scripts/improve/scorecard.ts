// The improve loop's scorecard: one JSON file of numbers the loop is judged on.
//
// Usage: npm run scorecard -- [--out reports/improve/scorecard-YYYY-MM-DD.json] [--live <live.json>]
//
// Offline parts come from this checkout: the backtest for the active rules version on the TUNING
// period only (held-out stays hidden, nothing is logged as a reveal), and counts from the source
// registry and the ladder coverage table. No database, no network. --live merges the nightly live
// scorecard from the data branch (scripts/improve/live-scorecard.mjs), read with
// `git show origin/data:improve/live.json > /tmp/live.json`.
//
// A protected file: the loop may run it, never change it without the tier 2 review panel.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SOURCE_REGISTRY } from "../../src/lib/ingest/registry";
import { UNTRACKED_RUNGS } from "../../src/lib/ladder/coverage";
import { CURRENT_RULES_VERSION } from "../../src/lib/ladder/rules";
import { cli, run, setup } from "../backtest/common";

const c = cli();
const out = c.flag("out");
const livePath = c.flag("live");

const s = setup(cli(["--rules", CURRENT_RULES_VERSION]), "scorecard");
if (s.revealed) throw new Error("the scorecard never reveals held-out results");
const { cards } = run(s);
const t = cards[0];
const rate = (cell: { weightedRate?: number; rate?: number }) => cell.weightedRate ?? cell.rate ?? null;
const round = (x: number | null | undefined, d = 4) => (x === null || x === undefined || !Number.isFinite(x) ? null : Number(x.toFixed(d)));

const metrics: Record<string, number | null> = {
  "bt.earlyActNowRight30": round(rate(t.actNow.preConfirmation)),
  "bt.kevCalledBeforeShare": round(t.leadTime.shareBeforeKev.rate),
  "bt.medianLeadDays": round(t.leadTime.medianPreKev, 1),
  "bt.watchHit90": round(rate(t.watch.hit90)),
  "bt.lowHoldKev": round(t.low.byStratum.kev.rate),
  "bt.kevActNowOnListingDay": round(t.coverage.rateOnKevDay.rate),
  "bt.transitionsPerCve": round(t.churn.transitionsPerCve, 3),
  "repo.sources": SOURCE_REGISTRY.length,
  "repo.keylessSources": SOURCE_REGISTRY.filter((d) => !d.requiresEnv?.length).length,
  "repo.untrackedRungs": Object.keys(UNTRACKED_RUNGS.vulnerability ?? {}).length,
};

let live: { at?: string; metrics?: Record<string, number | null> } | null = null;
if (livePath) {
  live = JSON.parse(readFileSync(livePath, "utf8"));
  Object.assign(metrics, live?.metrics ?? {});
}

let commit: string | null = null;
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  commit = null;
}

const card = {
  at: new Date().toISOString(),
  commit,
  rulesVersion: CURRENT_RULES_VERSION,
  backtest: { dataset: s.dsPath, builtAt: s.ds.builtAt, period: t.period, cves: t.cves },
  liveAt: live?.at ?? null,
  metrics,
};
const json = JSON.stringify(card, null, 2) + "\n";
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.error(`wrote ${out}`);
}
process.stdout.write(json);
