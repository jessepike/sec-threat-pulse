// Shared pieces of the backtest CLIs: flags, the held-out gate and its log, period setup, formatting.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { findDataset, loadDataset } from "../../src/lib/backtest/io";
import { DEFAULT_CIRCL_LAG_DAYS, replayDataset, type ReplayOptions } from "../../src/lib/backtest/replay";
import { datasetWeights, score, type Period, type RateCell, type Scorecard } from "../../src/lib/backtest/score";
import type { BacktestDataset, CveReplay, TruthMode } from "../../src/lib/backtest/types";
import { getRules } from "../../src/lib/ladder/rules";

export const REVEAL_LOG = "reports/backtest/heldout-reveals.log";

export interface Cli {
  args: string[];
  flag(name: string, dflt?: string): string | undefined;
  has(name: string): boolean;
}

export function cli(argv = process.argv.slice(2)): Cli {
  return {
    args: argv,
    flag: (name, dflt) => {
      const i = argv.indexOf(`--${name}`);
      return i >= 0 ? (argv[i + 1] ?? dflt) : dflt;
    },
    has: (name) => argv.includes(`--${name}`),
  };
}

export interface Setup {
  rules: string;
  dsPath: string;
  ds: BacktestDataset;
  from: string;
  to: string;
  split: string;
  replayOpts: ReplayOptions;
  /** Tuning period always; held-out and all only when revealed. */
  periods: Period[];
  revealed: boolean;
  weights: ReturnType<typeof datasetWeights>;
}

/**
 * Reads the common flags. Held-out results stay hidden unless --reveal-heldout is passed, and
 * every reveal is appended to reports/backtest/heldout-reveals.log so tuning can be audited.
 */
export function setup(c: Cli, purpose: string): Setup {
  const rules = c.flag("rules", "v1")!;
  getRules(rules);
  const dsPath = findDataset(c.flag("dataset"));
  const ds = loadDataset(dsPath);
  const FROM = c.flag("from", "2025-04-01")!;
  const TO = c.flag("to", "2026-10-01")!;
  const split = c.flag("split", "2026-04-01")!;
  const from = FROM > ds.from ? FROM : ds.from;
  const to = TO < ds.to ? TO : ds.to;
  const truth = (c.flag("truth", "catalog") as TruthMode) ?? "catalog";
  if (truth !== "catalog" && truth !== "circl") throw new Error(`--truth must be catalog or circl, got ${truth}`);
  const replayOpts: ReplayOptions = {
    rulesVersion: rules,
    from,
    to,
    circlLagDays: Number(c.flag("circl-lag", String(DEFAULT_CIRCL_LAG_DAYS))),
    truth,
    includeKevCatalogSightings: c.has("kev-catalog-sightings"),
  };
  const revealed = c.has("reveal-heldout");
  const dayBefore = (d: string) => new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10);
  const periods: Period[] = [{ name: "tuning", from, to: dayBefore(split) }];
  if (revealed) {
    periods.push({ name: "held-out", from: split, to });
    periods.push({ name: "all", from, to });
    logReveal({ purpose, rules, ds, dsPath, replayOpts, split, args: c.args });
  }
  return { rules, dsPath, ds, from, to, split, replayOpts, periods, revealed, weights: datasetWeights(ds) };
}

function logReveal(x: { purpose: string; rules: string; ds: BacktestDataset; dsPath: string; replayOpts: ReplayOptions; split: string; args: string[] }): void {
  mkdirSync(dirname(REVEAL_LOG), { recursive: true });
  const line = [
    new Date().toISOString(),
    `rules=${x.rules}`,
    `purpose=${x.purpose}`,
    `dataset=${x.dsPath}@${x.ds.builtAt}`,
    `split=${x.split}`,
    `lag=${x.replayOpts.circlLagDays}`,
    `truth=${x.replayOpts.truth}`,
    `kevCatalogSightings=${x.replayOpts.includeKevCatalogSightings ? 1 : 0}`,
    `args=${JSON.stringify(x.args)}`,
  ].join(" ");
  appendFileSync(REVEAL_LOG, line + "\n");
}

export function run(s: Setup, opts: Partial<ReplayOptions> = {}): { replays: CveReplay[]; cards: Scorecard[]; ms: number } {
  const t0 = Date.now();
  const replays = replayDataset(s.ds, { ...s.replayOpts, ...opts });
  const ms = Date.now() - t0;
  const cards = s.periods.map((period) => score(replays, { dataEnd: s.ds.dataEnd, weights: s.weights, period }));
  return { replays, cards, ms };
}

export const pct = (x?: number) => (x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`);
export const pct0 = (x: number) => `${Math.round(x * 100)}`;
export const num = (x?: number, d = 1) => (x === undefined ? "n/a" : x.toFixed(d));

/** "37.6% (31 to 44)" from a rate and its interval. */
export function rateCi(rate?: number, ci?: [number, number]): string {
  if (rate === undefined) return "n/a";
  return ci ? `${pct(rate)} (${pct0(ci[0])} to ${pct0(ci[1])})` : pct(rate);
}
/** Weighted rate with CI, then the sampled count. */
export const weightedCell = (c: RateCell) => `${rateCi(c.weightedRate ?? c.rate, c.weightedRate !== undefined ? c.weightedCi : c.ci)}; ${c.hits}/${c.n}`;
/** Sampled rate with CI and count. */
export const sampledCell = (c: RateCell) => `${rateCi(c.rate, c.ci)}; ${c.hits}/${c.n}`;

export function hiddenNote(s: Setup): string {
  return s.revealed ? "" : "Held-out and whole-window results are hidden. Pass --reveal-heldout to show them (every reveal is logged).";
}
