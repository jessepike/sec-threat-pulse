// Pure replay: for one CVE and one day, rebuild the observations that were public on that day,
// compute the ladder and exploit maturity with the production functions, and apply a rules version.
// No I/O here. The dataset loader lives in io.ts and the scoring in score.ts.

import { computeExploitMaturity, computeLadder, reportedExploitationSources, type LadderObservation } from "@/lib/ladder/compute";
import { getRules, type VerdictContext } from "@/lib/ladder/rules";
import type { Verdict } from "@/lib/ladder/types";
import { circlRung } from "@/lib/ingest/adapters/circl-sightings";
import { categorize } from "@/lib/ladder/category";
import type { BacktestCve, BacktestDataset, CirclSighting, ConfirmedBy, CveReplay, TruthMode, VerdictTransition } from "./types";

const DAY = 86400000;

export const dayNumber = (d: string): number => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);
export const dayString = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (d: string, n: number): string => dayString(dayNumber(d) + n);
export const daysBetween = (a: string, b: string): number => dayNumber(b) - dayNumber(a);

/** CIRCL sightings are seen this many days after their creation timestamp. See circlSeenOn. */
export const DEFAULT_CIRCL_LAG_DAYS = 1;

export interface ReplayOptions {
  rulesVersion: string;
  from: string;
  to: string;
  /** Count CIRCL sightings that mirror a KEV catalog. Off by default: they repeat the catalogs. */
  includeKevCatalogSightings?: boolean;
  /** Days between a CIRCL sighting's timestamp and the day the replay first sees it. Default 1. */
  circlLagDays?: number;
  /** Ground truth definition. Default "catalog". */
  truth?: TruthMode;
}

/**
 * The day a CIRCL sighting becomes visible to the replay. The live site polls hourly, so most
 * sightings are seen the same day or the next, and CIRCL backfills some sightings with earlier
 * creation timestamps. One day of lag is the default; zero shows the optimistic figure.
 */
export const circlSeenOn = (s: CirclSighting, lagDays: number): string => (lagDays ? addDays(s.date, lagDays) : s.date);

/** EPSS score in force on a day: the last change point at or before it. */
export function epssAsOf(points: [string, number][], day: string): number | undefined {
  let value: number | undefined;
  for (const [d, s] of points) {
    if (d > day) break;
    value = s;
  }
  return value;
}

export interface DayState {
  observations: LadderObservation[];
  ctx: VerdictContext;
}

/** Everything that was public about the CVE on `day`, in the shape the ladder and rules expect. */
export function stateAsOf(cve: BacktestCve, day: string, opts: Pick<ReplayOptions, "includeKevCatalogSightings" | "circlLagDays"> = {}): DayState {
  const lag = opts.circlLagDays ?? DEFAULT_CIRCL_LAG_DAYS;
  const obs: LadderObservation[] = [];
  const maturities: string[] = [];
  const on = (d?: string) => !!d && d <= day;

  if (on(cve.kev?.dateAdded)) obs.push({ sourceId: "cisa-kev", kind: "exploited", strength: "confirmed" });
  if (on(cve.vulncheckKev?.dateAdded)) obs.push({ sourceId: "vulncheck-kev", kind: "exploited", strength: "confirmed" });
  if (on(cve.ssvc?.active)) obs.push({ sourceId: "cvelist", kind: "exploited", strength: "confirmed", metadata: { ssvc: { exploitation: "active" } } });
  else if (on(cve.ssvc?.poc)) {
    obs.push({ sourceId: "cvelist", kind: "exploit_available", strength: "reported", metadata: { maturity: "poc" } });
    maturities.push("poc");
  }
  for (const d of cve.metasploit) if (on(d)) obs.push({ sourceId: "metasploit", kind: "exploit_available", strength: "confirmed", metadata: { maturity: "weaponized" } });
  if (on(cve.nuclei)) obs.push({ sourceId: "nuclei", kind: "exploit_available", strength: "confirmed", metadata: { maturity: "weaponized" } });
  const repos = cve.pocGithub.filter((r) => on(r.created));
  if (repos.length) obs.push({ sourceId: "poc-github", kind: "exploit_available", strength: "claimed", metadata: { maturity: "poc", repoCount: repos.length } });
  for (const d of cve.exploitdb) if (on(d)) obs.push({ sourceId: "exploitdb", kind: "exploit_available", strength: "reported", metadata: { maturity: "poc" } });
  for (const s of cve.circl) {
    if (!on(circlSeenOn(s, lag))) continue;
    const mapped = circlObservation(s, opts.includeKevCatalogSightings ?? false);
    if (mapped) obs.push(mapped);
  }

  // v3 inputs. Confirmation: the earliest KEV listing or SSVC active decision on or before the day.
  // First report: the earliest dated attack, exploitation or damage signal seen by the day, which
  // includes the confirmation itself. Older rule versions ignore these fields.
  const confirmedDays = [cve.kev?.dateAdded, cve.vulncheckKev?.dateAdded, cve.ssvc?.active].filter((d): d is string => on(d)).sort();
  const reportDays = cve.circl
    .filter((s) => s.type === "exploited" && s.sourceKind !== "kev-catalog")
    .map((s) => circlSeenOn(s, lag))
    .filter((d) => on(d))
    .concat(confirmedDays)
    .sort();

  const ctx: VerdictContext = {
    exploitMaturity: computeExploitMaturity(obs, maturities),
    daysSinceConfirmed: confirmedDays.length ? daysBetween(confirmedDays[0], day) : undefined,
    daysSinceFirstReport: reportDays.length ? daysBetween(reportDays[0], day) : undefined,
    categoryId: categorize(cve.vendor, cve.product).id,
    epss: epssAsOf(cve.epss, day),
    kevRansomware: on(cve.kev?.dateAdded) ? cve.kev!.ransomware : false,
    vendor: cve.vendor,
    product: cve.product,
    cvss: cve.cvss,
    daysSincePublished: cve.published ? Math.max(0, daysBetween(cve.published, day)) : undefined,
    pocRepoCount: repos.length,
    reportedExploitationSources: reportedExploitationSources(obs),
  };
  return { observations: obs, ctx };
}

/**
 * CIRCL sighting to observation through the live adapter's own mapping (circlRung), so the
 * backtest and production cannot drift. The parity test in replay.test.ts checks this. The one
 * extra switch, includeKevCatalog, exists only to show what the old production mapping did.
 */
export function circlObservation(s: CirclSighting, includeKevCatalog: boolean): LadderObservation | undefined {
  const sourceId = "circl-sightings";
  if (includeKevCatalog && s.type === "exploited" && s.sourceKind === "kev-catalog") return { sourceId, kind: "exploited", strength: "reported" };
  const r = circlRung(s.type, s.sourceKind, s.sourceId);
  return r ? { sourceId, kind: r.kind, strength: r.strength, metadata: r.metadata } : undefined;
}

const VERDICT_RANK: Record<Verdict, number> = { low: 0, watch: 1, act_now: 2 };
export const verdictRank = (v: Verdict) => VERDICT_RANK[v];

/**
 * The day exploitation counts as confirmed for scoring. Default truth: CISA KEV, VulnCheck KEV
 * (when the dataset has it) and vendor confirmed exploitation. A CISA SSVC "active" decision is
 * an input to the ladder but not ground truth: in this data it is the KEV decision seen through
 * another feed. Honeypot hits are attack attempts and never confirm exploitation.
 *
 * truth "circl" adds two independent CIRCL exploitation reports (distinct non catalog, non
 * honeypot sources) as a secondary view. Reports are placed on the day the replay sees them.
 */
export function confirmation(cve: BacktestCve, opts: Pick<ReplayOptions, "truth" | "circlLagDays"> = {}): { at?: string; by?: ConfirmedBy } {
  const candidates: { at: string; by: ConfirmedBy }[] = [];
  if (cve.kev) candidates.push({ at: cve.kev.dateAdded, by: "cisa-kev" });
  if (cve.vulncheckKev) candidates.push({ at: cve.vulncheckKev.dateAdded, by: "vulncheck-kev" });
  if (cve.vendorConfirmed) candidates.push({ at: cve.vendorConfirmed, by: "vendor" });
  if (opts.truth === "circl") {
    const lag = opts.circlLagDays ?? DEFAULT_CIRCL_LAG_DAYS;
    const reports = cve.circl
      .filter((s) => s.type === "exploited" && s.sourceKind !== "kev-catalog" && s.sourceKind !== "honeypot")
      .map((s) => ({ ...s, date: circlSeenOn(s, lag) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const seen = new Set<string>();
    for (const r of reports) {
      seen.add(r.sourceId);
      if (seen.size >= 2) {
        candidates.push({ at: r.date, by: "circl-reports" });
        break;
      }
    }
  }
  candidates.sort((a, b) => a.at.localeCompare(b.at));
  return candidates[0] ?? {};
}

/** Replay one CVE day by day and keep only the days the verdict changed. */
export function replayCve(cve: BacktestCve, opts: ReplayOptions): CveReplay {
  const rules = getRules(opts.rulesVersion);
  const start = cve.published && cve.published > opts.from ? cve.published : opts.from;
  const end = opts.to;
  const transitions: VerdictTransition[] = [];
  let last: Verdict | undefined;
  if (start <= end) {
    for (let n = dayNumber(start); n <= dayNumber(end); n++) {
      const day = dayString(n);
      const { observations, ctx } = stateAsOf(cve, day, opts);
      const r = rules.evaluate(computeLadder(observations), ctx);
      if (r.verdict !== last) {
        transitions.push({ day, verdict: r.verdict, reason: r.reason });
        last = r.verdict;
      }
    }
  }
  const c = confirmation(cve, opts);
  const leftCensored = !!cve.published && cve.published < opts.from && transitions[0]?.day === opts.from && transitions[0].verdict !== "low";
  return { cveId: cve.cveId, stratum: cve.stratum, start, end, transitions, ...(leftCensored ? { leftCensored } : {}), confirmedAt: c.at, confirmedBy: c.by, kevDate: cve.kev?.dateAdded };
}

export function replayDataset(ds: BacktestDataset, opts: ReplayOptions): CveReplay[] {
  return ds.cves.map((c) => replayCve(c, opts));
}

/** Verdict in force on a day, or undefined before the first transition. */
export function verdictOn(r: CveReplay, day: string): Verdict | undefined {
  let v: Verdict | undefined;
  for (const t of r.transitions) {
    if (t.day > day) break;
    v = t.verdict;
  }
  return v;
}

/** First day the verdict reached at least `min`. */
export function firstDayAtLeast(r: CveReplay, min: Verdict): string | undefined {
  return r.transitions.find((t) => verdictRank(t.verdict) >= verdictRank(min))?.day;
}
