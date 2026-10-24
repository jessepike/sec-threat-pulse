// Pure scoring of replayed verdicts against outcomes. No I/O.
//
// Every metric places a CVE in a period by the day of the call it scores (first Act now day,
// first Watch day, the Low days themselves), never by the day the outcome arrived. Lead time and
// coverage are about KEV listings, so they use the listing day.

import type { Verdict } from "@/lib/ladder/types";
import { addDays, daysBetween, firstDayAtLeast, verdictOn, verdictRank } from "./replay";
import { STRATA, type BacktestDataset, type CveReplay, type Stratum } from "./types";

export const HORIZON_DAYS = 30;
export const WATCH_HORIZON_DAYS = 90;

export interface Period {
  name: string;
  from: string;
  to: string;
}

export interface ScoreOptions {
  /** Last day with complete outcome data. */
  dataEnd: string;
  period: Period;
  /** Population over sample size per stratum. Missing strata weigh 1. */
  weights?: Partial<Record<Stratum, number>>;
}

export interface RateCell {
  n: number;
  hits: number;
  rate?: number;
  /** 95% Wilson interval on the sampled rate. */
  ci?: [number, number];
  /** Population weighted rate, when weights were given. */
  weightedRate?: number;
  /** 95% Wilson interval on the weighted rate, using the Kish effective sample size. */
  weightedCi?: [number, number];
  /** Kish effective sample size behind weightedCi: (sum w)^2 / sum w^2. */
  effectiveN?: number;
}

export interface Scorecard {
  period: Period;
  dataEnd: string;
  /** CVEs with at least one replayed day in the period. */
  cves: number;
  byStratum: Record<Stratum, number>;
  actNow: {
    /** Every first Act now call in the period, including calls made on or after confirmation. */
    all: RateCell;
    /** Calls made before any confirmation existed, 30 day horizon. The headline. */
    preConfirmation: RateCell;
    /** Same calls, 90 day horizon. */
    preConfirmation90: RateCell;
    /** Calls made on or after the confirmation day. True by construction. */
    postConfirmation: number;
    unscoreable: number;
    byStratum: Record<Stratum, RateCell>;
    preByStratum: Record<Stratum, RateCell>;
  };
  low: {
    /** CVEs with Low days in the period that saw no confirmation within 30 days of any of them. */
    hold: RateCell;
    byStratum: Record<Stratum, RateCell>;
    /** Same measure if every replayed day were Low. The floor Low hold must be read against. */
    alwaysLow: RateCell;
    alwaysLowByStratum: Record<Stratum, RateCell>;
    /** CVEs whose Low hold failed in the period. */
    missed: string[];
  };
  watch: {
    /** First Watch calls (before any confirmation) followed by confirmation within 90 days. */
    hit90: RateCell;
  };
  leadTime: {
    kevInPeriod: number;
    called: number;
    calledBeforeKev: number;
    /** Share of KEV listings in the period with an Act now before the listing day. */
    shareBeforeKev: RateCell;
    medianAll?: number;
    medianPreKev?: number;
    meanPreKev?: number;
    p25PreKev?: number;
    p75PreKev?: number;
    /** Lead days for each KEV CVE called before listing (positive = days ahead). */
    leads: number[];
    /** Same for Watch or higher. */
    watchCalledBeforeKev: number;
    medianWatchLead?: number;
  };
  coverage: {
    kevInPeriod: number;
    actNowOnKevDay: number;
    actNowEver: number;
    rateOnKevDay: RateCell;
    rateEver: RateCell;
  };
  churn: {
    transitionsPerCve: number;
    downgrades: number;
    cvesWithDowngrade: number;
    cvesWithThreePlusTransitions: number;
  };
  /** Peak verdict before confirmation (rows) against the outcome (columns), CVEs replayed in the period. */
  confusion: Record<Verdict | "none", { exploited: number; notExploited: number }>;
}

const byStratum = <T>(f: () => T): Record<Stratum, T> => Object.fromEntries(STRATA.map((s) => [s, f()])) as Record<Stratum, T>;

interface Acc {
  n: number;
  hits: number;
  wn: number;
  whits: number;
  wsq: number;
}
const acc = (): Acc => ({ n: 0, hits: 0, wn: 0, whits: 0, wsq: 0 });
const add = (a: Acc, hit: boolean, w: number) => {
  a.n++;
  a.wn += w;
  a.wsq += w * w;
  if (hit) {
    a.hits++;
    a.whits += w;
  }
};

/** 95% Wilson score interval for `hits` successes in `n` trials. n may be fractional (effective n). */
export function wilson(hits: number, n: number, z = 1.96): [number, number] | undefined {
  if (!(n > 0)) return undefined;
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export const finish = (a: Acc, weighted: boolean): RateCell => {
  const cell: RateCell = { n: a.n, hits: a.hits, rate: a.n ? a.hits / a.n : undefined, ci: wilson(a.hits, a.n) };
  if (weighted && a.wn) {
    const p = a.whits / a.wn;
    const nEff = (a.wn * a.wn) / a.wsq;
    cell.weightedRate = p;
    cell.effectiveN = nEff;
    cell.weightedCi = wilson(p * nEff, nEff);
  }
  return cell;
};

const finishAll = (r: Record<Stratum, Acc>): Record<Stratum, RateCell> => Object.fromEntries(STRATA.map((s) => [s, finish(r[s], false)])) as Record<Stratum, RateCell>;

export function median(xs: number[]): number | undefined {
  return quantile(xs, 0.5);
}

export function quantile(xs: number[], q: number): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function inPeriod(day: string, p: Period): boolean {
  return day >= p.from && day <= p.to;
}

/** Peak verdict over days before confirmation (all days when never confirmed). */
export function peakBeforeConfirmation(r: CveReplay): Verdict | "none" {
  let best: Verdict | "none" = "none";
  for (const t of r.transitions) {
    if (r.confirmedAt && t.day >= r.confirmedAt) break;
    if (best === "none" || verdictRank(t.verdict) > verdictRank(best)) best = t.verdict;
  }
  return best;
}

const minDay = (...ds: string[]) => ds.reduce((a, b) => (a < b ? a : b));
const maxDay = (...ds: string[]) => ds.reduce((a, b) => (a > b ? a : b));

export function score(replays: CveReplay[], opts: ScoreOptions): Scorecard {
  const weighted = !!opts.weights;
  const w = (s: Stratum) => opts.weights?.[s] ?? 1;
  const p = opts.period;
  const lastScoreableDay = addDays(opts.dataEnd, -HORIZON_DAYS);
  const lastScoreable90 = addDays(opts.dataEnd, -WATCH_HORIZON_DAYS);

  const act = { all: acc(), pre: acc(), pre90: acc(), post: 0, unscoreable: 0, byStratum: byStratum(acc), preByStratum: byStratum(acc) };
  const low = { hold: acc(), byStratum: byStratum(acc), always: acc(), alwaysByStratum: byStratum(acc), missed: [] as string[] };
  const watch = { hit90: acc() };
  const leads: number[] = [];
  const allLeads: number[] = [];
  const watchLeads: number[] = [];
  const before = acc();
  const onDay = acc();
  const ever = acc();
  let kevInPeriod = 0;
  let called = 0;
  let transitions = 0;
  let downgrades = 0;
  let cvesWithDowngrade = 0;
  let cvesWithThreePlus = 0;
  let cves = 0;
  const counts = byStratum(() => 0);
  const confusion: Scorecard["confusion"] = { none: { exploited: 0, notExploited: 0 }, low: { exploited: 0, notExploited: 0 }, watch: { exploited: 0, notExploited: 0 }, act_now: { exploited: 0, notExploited: 0 } };

  for (const r of replays) {
    const weight = w(r.stratum);
    const confirmedAt = r.confirmedAt;
    const replayed = r.start <= r.end && r.start <= p.to && r.end >= p.from;
    if (replayed) {
      cves++;
      counts[r.stratum]++;
    }

    // Act now precision, placed by the call day.
    const d0 = firstDayAtLeast(r, "act_now");
    if (d0 && inPeriod(d0, p)) {
      if (d0 > lastScoreableDay) act.unscoreable++;
      else {
        const hit = !!confirmedAt && confirmedAt <= addDays(d0, HORIZON_DAYS);
        add(act.all, hit, weight);
        add(act.byStratum[r.stratum], hit, weight);
        if (confirmedAt && confirmedAt <= d0) act.post++;
        else {
          add(act.pre, hit, weight);
          add(act.preByStratum[r.stratum], hit, weight);
          if (d0 <= lastScoreable90) add(act.pre90, !!confirmedAt && confirmedAt <= addDays(d0, WATCH_HORIZON_DAYS), weight);
        }
      }
    }

    // Low hold: the Low days inside the period, each needing 30 days of follow-up.
    let lowScoreable = false;
    let held = true;
    for (let i = 0; i < r.transitions.length; i++) {
      const t = r.transitions[i];
      if (t.verdict !== "low") continue;
      const stretchEnd = i + 1 < r.transitions.length ? addDays(r.transitions[i + 1].day, -1) : r.end;
      const pieceStart = maxDay(t.day, p.from);
      const pieceEnd = minDay(stretchEnd, p.to, lastScoreableDay);
      if (pieceEnd < pieceStart) continue;
      lowScoreable = true;
      if (confirmedAt && confirmedAt <= addDays(pieceEnd, HORIZON_DAYS)) held = false;
    }
    if (lowScoreable) {
      add(low.hold, held, weight);
      add(low.byStratum[r.stratum], held, weight);
      if (!held) low.missed.push(r.cveId);
    }

    // Always-Low baseline over the same replayed days.
    if (replayed) {
      const pieceStart = maxDay(r.start, p.from);
      const pieceEnd = minDay(r.end, p.to, lastScoreableDay);
      if (pieceEnd >= pieceStart) {
        const h = !(confirmedAt && confirmedAt <= addDays(pieceEnd, HORIZON_DAYS));
        add(low.always, h, weight);
        add(low.alwaysByStratum[r.stratum], h, weight);
      }
    }

    // Watch: did the first Watch or higher call (before confirmation) see confirmation within 90 days?
    const w0 = firstDayAtLeast(r, "watch");
    if (w0 && inPeriod(w0, p) && (!confirmedAt || confirmedAt > w0) && w0 <= lastScoreable90) {
      add(watch.hit90, !!confirmedAt && confirmedAt <= addDays(w0, WATCH_HORIZON_DAYS), weight);
    }

    // Lead time and coverage against KEV listings inside the period.
    if (r.kevDate && inPeriod(r.kevDate, p)) {
      kevInPeriod++;
      let lead: number | undefined;
      if (d0) {
        called++;
        lead = daysBetween(d0, r.kevDate);
        allLeads.push(lead);
        if (lead > 0) leads.push(lead);
      }
      add(before, lead !== undefined && lead > 0, 1);
      add(ever, !!d0, 1);
      add(onDay, verdictOn(r, r.kevDate) === "act_now", 1);
      if (w0) {
        const wl = daysBetween(w0, r.kevDate);
        if (wl > 0) watchLeads.push(wl);
      }
    }

    // Churn, counted on transitions inside the period.
    const inside = r.transitions.filter((t) => inPeriod(t.day, p));
    transitions += inside.length;
    let down = 0;
    for (let i = 1; i < r.transitions.length; i++) {
      if (!inPeriod(r.transitions[i].day, p)) continue;
      if (verdictRank(r.transitions[i].verdict) < verdictRank(r.transitions[i - 1].verdict)) down++;
    }
    downgrades += down;
    if (down) cvesWithDowngrade++;
    if (inside.length >= 3) cvesWithThreePlus++;

    // Confusion.
    if (replayed) {
      const peak = peakBeforeConfirmation(r);
      const exploited = !!confirmedAt && confirmedAt <= addDays(r.end, HORIZON_DAYS);
      confusion[peak][exploited ? "exploited" : "notExploited"]++;
    }
  }

  return {
    period: p,
    dataEnd: opts.dataEnd,
    cves,
    byStratum: counts,
    actNow: {
      all: finish(act.all, weighted),
      preConfirmation: finish(act.pre, weighted),
      preConfirmation90: finish(act.pre90, weighted),
      postConfirmation: act.post,
      unscoreable: act.unscoreable,
      byStratum: finishAll(act.byStratum),
      preByStratum: finishAll(act.preByStratum),
    },
    low: {
      hold: finish(low.hold, weighted),
      byStratum: finishAll(low.byStratum),
      alwaysLow: finish(low.always, weighted),
      alwaysLowByStratum: finishAll(low.alwaysByStratum),
      missed: low.missed,
    },
    watch: { hit90: finish(watch.hit90, weighted) },
    leadTime: {
      kevInPeriod,
      called,
      calledBeforeKev: leads.length,
      shareBeforeKev: finish(before, false),
      medianAll: median(allLeads),
      medianPreKev: median(leads),
      meanPreKev: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : undefined,
      p25PreKev: quantile(leads, 0.25),
      p75PreKev: quantile(leads, 0.75),
      leads,
      watchCalledBeforeKev: watchLeads.length,
      medianWatchLead: median(watchLeads),
    },
    coverage: {
      kevInPeriod,
      actNowOnKevDay: onDay.hits,
      actNowEver: ever.hits,
      rateOnKevDay: finish(onDay, false),
      rateEver: finish(ever, false),
    },
    churn: {
      transitionsPerCve: cves ? transitions / cves : 0,
      downgrades,
      cvesWithDowngrade,
      cvesWithThreePlusTransitions: cvesWithThreePlus,
    },
    confusion,
  };
}

/** Population over sample weights from the dataset's sampling record. */
export function datasetWeights(ds: BacktestDataset): Record<Stratum, number> {
  const out = {} as Record<Stratum, number>;
  for (const s of STRATA) {
    const n = ds.sampling.sampled[s] ?? 0;
    out[s] = n ? (ds.sampling.population[s] ?? n) / n : 1;
  }
  return out;
}
