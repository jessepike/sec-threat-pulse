import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RateCell, Scorecard } from "@/lib/backtest/score";

// Read only helpers for the committed backtest reports in reports/backtest/.

export interface BacktestReport {
  file: string;
  rulesVersion: string;
  ranAt: string;
  window: { from: string; to: string; split: string };
  dataset: { builtAt: string; cves: number };
  scorecards: Scorecard[];
}

export interface RevealEntry {
  at: string;
  rules: string;
  purpose: string;
  dataset: string;
  args: string;
}

const dir = () => path.join(process.cwd(), "reports", "backtest");

/** Latest report for each rules version (by run time). Empty when the folder cannot be read. */
export async function latestReports(): Promise<Record<string, BacktestReport>> {
  const out: Record<string, BacktestReport> = {};
  let names: string[] = [];
  try {
    names = (await readdir(dir())).filter((n) => /^v\d+-.*\.json$/.test(n));
  } catch {
    return out;
  }
  for (const file of names) {
    try {
      const j = JSON.parse(await readFile(path.join(dir(), file), "utf8"));
      const r: BacktestReport = {
        file,
        rulesVersion: String(j.rulesVersion),
        ranAt: String(j.ranAt ?? ""),
        window: j.window,
        dataset: { builtAt: String(j.dataset?.builtAt ?? ""), cves: Number(j.dataset?.cves ?? 0) },
        scorecards: j.scorecards ?? [],
      };
      if (!out[r.rulesVersion] || r.ranAt > out[r.rulesVersion].ranAt) out[r.rulesVersion] = r;
    } catch {
      // A broken report file is skipped; the page shows the rest.
    }
  }
  return out;
}

/** Parses the held out reveal log, one entry per line, newest last. */
export async function revealLog(): Promise<RevealEntry[] | null> {
  let text: string;
  try {
    text = await readFile(path.join(dir(), "heldout-reveals.log"), "utf8");
  } catch {
    return null;
  }
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [at, ...rest] = line.trim().split(/\s+/);
      const kv = Object.fromEntries(rest.map((t) => { const i = t.indexOf("="); return i < 0 ? [t, ""] : [t.slice(0, i), t.slice(i + 1)]; }));
      return { at, rules: kv.rules ?? "", purpose: kv.purpose ?? "", dataset: kv.dataset ?? "", args: kv.args ?? "" };
    });
}

export const pct = (x: number | undefined, digits = 1) => (x === undefined || !Number.isFinite(x) ? "n/a" : `${(x * 100).toFixed(digits)}%`);

/** "43.4% (35 to 53); 49/113". Uses the population weighted rate and interval when present. */
export function fmtCell(c: RateCell | undefined): string {
  if (!c || c.n === 0) return "n/a";
  const rate = c.weightedRate ?? c.rate;
  const ci = c.weightedCi ?? c.ci;
  const range = ci ? ` (${Math.round(ci[0] * 100)} to ${Math.round(ci[1] * 100)})` : "";
  return `${pct(rate)}${range}; ${c.hits}/${c.n}`;
}

export const period = (r: BacktestReport | undefined, name: "tuning" | "held-out" | "all") => r?.scorecards.find((s) => s.period.name === name);

export interface HeadlineRow {
  label: string;
  note?: string;
  cells: Record<"tuning" | "held-out" | "all", string>;
}

/** The measures the methodology page leads with, for one report. */
export function headlineRows(r: BacktestReport): HeadlineRow[] {
  const each = (f: (s: Scorecard) => string): HeadlineRow["cells"] => ({
    tuning: period(r, "tuning") ? f(period(r, "tuning")!) : "n/a",
    "held-out": period(r, "held-out") ? f(period(r, "held-out")!) : "n/a",
    all: period(r, "all") ? f(period(r, "all")!) : "n/a",
  });
  return [
    { label: "Act now before confirmation, right within 30 days", note: "Headline. Population weighted.", cells: each((s) => fmtCell(s.actNow.preConfirmation)) },
    { label: "Same calls, 90 day horizon", cells: each((s) => fmtCell(s.actNow.preConfirmation90)) },
    { label: "Watch confirmed within 90 days", cells: each((s) => fmtCell(s.watch.hit90)) },
    { label: "Low hold, KEV stratum, 30 days", note: "Read against the always Low baseline in the report.", cells: each((s) => fmtCell(s.low.byStratum.kev)) },
    { label: "KEV additions with an Act now before listing", cells: each((s) => fmtCell(s.leadTime.shareBeforeKev)) },
    {
      label: "Median lead of those calls, days",
      cells: each((s) => (s.leadTime.medianPreKev === undefined ? "n/a" : `${s.leadTime.medianPreKev} (quartiles ${s.leadTime.p25PreKev} and ${s.leadTime.p75PreKev})`)),
    },
    { label: "Act now precision, all calls", note: "Secondary. Mostly true by construction.", cells: each((s) => fmtCell(s.actNow.all)) },
    { label: "KEV additions Act now on listing day", note: "Secondary.", cells: each((s) => fmtCell(s.coverage.rateOnKevDay)) },
  ];
}
