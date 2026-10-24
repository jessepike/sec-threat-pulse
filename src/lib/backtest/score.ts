// Pure scoring of replayed verdicts against outcomes. No I/O.

import type { Verdict } from "@/lib/ladder/types";
import { addDays, daysBetween, firstDayAtLeast, verdictOn, verdictRank } from "./replay";
import type { BacktestDataset, CveReplay, Stratum } from "./types";

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
  /** Published date per CVE, used as the anchor for CVEs never listed in KEV. */
  anchors: Record<string, string | undefined>;
}

export interface RateCell {
  n: number;
  hits: number;
  rate?: number;
  /** Population weighted rate, when weights were given. */
  weightedRate?: number;
}

export interface Scorecard {
  period: Period;
  dataEnd: string;
  cves: number;
  byStratum: Record<Stratum, number>;
  actNow: {
    all: RateCell;
    preConfirmation: RateCell;
    /** Same calls, scored with a 90 day horizon. Shows how many "misses" were listed later. */
    preConfirmation90: RateCell;
    postConfirmation: number;
    unscoreable: number;
    byStratum: Record<Stratum, RateCell>;
  };
  low: {
    hold: RateCell;
    byStratum: Record<Stratum, RateCell>;
    /** CVEs that were still Low on the day exploitation was confirmed (or within 30 days before). */
    missed: string[];
  };
  watch: {
    /** Watch calls followed by confirmation within 90 days. */
    hit90: RateCell;
  };
  leadTime: {
    kevInPeriod: number;
    called: number;
    calledBeforeKev: number;
    shareBeforeKev?: number;
    medianAll?: number;
    medianPreKev?: number;
    meanPreKev?: number;
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
    rateOnKevDay?: number;
    rateEver?: number;
  };
  churn: {
    transitionsPerCve: number;
    downgrades: number;
    cvesWithDowngrade: number;
    cvesWithThreePlusTransitions: number;
  };
  /** Peak verdict before confirmation (rows) against the outcome (columns). */
  confusion: Record<Verdict | "none", { exploited: number; notExploited: number }>;
}

const strata: Stratum[] = ["kev", "signal", "random"];
const byStratum = <T>(f: () => T): Record<Stratum, T> => ({ kev: f(), signal: f(), random: f() });

interface Acc {
  n: number;
  hits: number;
  wn: number;
  whits: number;
}
const acc = (): Acc => ({ n: 0, hits: 0, wn: 0, whits: 0 });
const add = (a: Acc, hit: boolean, w: number) => {
  a.n++;
  a.wn += w;
  if (hit) {
    a.hits++;
    a.whits += w;
  }
};
const finish = (a: Acc, weighted: boolean): RateCell => ({
  n: a.n,
  hits: a.hits,
  rate: a.n ? a.hits / a.n : undefined,
  weightedRate: weighted && a.wn ? a.whits / a.wn : undefined,
});

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Anchor day used to place a CVE in a period: its KEV listing, else its publish day. */
export function anchorDay(r: CveReplay, published?: string): string {
  return r.kevDate ?? published ?? r.start;
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

export function score(replays: CveReplay[], opts: ScoreOptions): Scorecard {
  const weighted = !!opts.weights;
  const w = (s: Stratum) => opts.weights?.[s] ?? 1;
  const rows = replays.filter((r) => inPeriod(anchorDay(r, opts.anchors[r.cveId]), opts.period));
  const lastScoreableDay = addDays(opts.dataEnd, -HORIZON_DAYS);

  const act = { all: acc(), pre: acc(), pre90: acc(), post: 0, unscoreable: 0, byStratum: byStratum(acc) };
  const lastScoreable90 = addDays(opts.dataEnd, -WATCH_HORIZON_DAYS);
  const low = { hold: acc(), byStratum: byStratum(acc), missed: [] as string[] };
  const watch = { hit90: acc() };
  const leads: number[] = [];
  const allLeads: number[] = [];
  const watchLeads: number[] = [];
  let kevInPeriod = 0;
  let called = 0;
  let actNowOnKevDay = 0;
  let actNowEver = 0;
  let transitions = 0;
  let downgrades = 0;
  let cvesWithDowngrade = 0;
  let cvesWithThreePlus = 0;
  const confusion: Scorecard["confusion"] = { none: { exploited: 0, notExploited: 0 }, low: { exploited: 0, notExploited: 0 }, watch: { exploited: 0, notExploited: 0 }, act_now: { exploited: 0, notExploited: 0 } };
  const counts = byStratum(() => 0);

  for (const r of rows) {
    counts[r.stratum]++;
    const weight = w(r.stratum);
    const confirmedAt = r.confirmedAt;

    // Act now precision.
    const d0 = firstDayAtLeast(r, "act_now");
    if (d0) {
      if (d0 > lastScoreableDay) act.unscoreable++;
      else {
        const hit = !!confirmedAt && confirmedAt <= addDays(d0, HORIZON_DAYS);
        add(act.all, hit, weight);
        add(act.byStratum[r.stratum], hit, weight);
        if (confirmedAt && confirmedAt <= d0) act.post++;
        else {
          add(act.pre, hit, weight);
          if (d0 <= lastScoreable90) add(act.pre90, !!confirmedAt && confirmedAt <= addDays(d0, WATCH_HORIZON_DAYS), weight);
        }
      }
    }

    // Low hold: every Low stretch with follow-up must stay unconfirmed for 30 days.
    let lowScoreable = false;
    let held = true;
    for (let i = 0; i < r.transitions.length; i++) {
      const t = r.transitions[i];
      if (t.verdict !== "low") continue;
      const stretchStart = t.day;
      const stretchEnd = i + 1 < r.transitions.length ? addDays(r.transitions[i + 1].day, -1) : r.end;
      const scoreableEnd = stretchEnd < lastScoreableDay ? stretchEnd : lastScoreableDay;
      if (scoreableEnd < stretchStart) continue;
      lowScoreable = true;
      if (confirmedAt && confirmedAt <= addDays(scoreableEnd, HORIZON_DAYS)) held = false;
    }
    if (lowScoreable) {
      add(low.hold, held, weight);
      add(low.byStratum[r.stratum], held, weight);
      if (!held) low.missed.push(r.cveId);
    }

    // Watch: did a Watch call (first time at Watch or higher) see confirmation within 90 days?
    const w0 = firstDayAtLeast(r, "watch");
    if (w0 && (!confirmedAt || confirmedAt > w0) && w0 <= addDays(opts.dataEnd, -WATCH_HORIZON_DAYS)) {
      add(watch.hit90, !!confirmedAt && confirmedAt <= addDays(w0, WATCH_HORIZON_DAYS), weight);
    }

    // Lead time and coverage against KEV listings inside the period.
    if (r.kevDate && inPeriod(r.kevDate, opts.period)) {
      kevInPeriod++;
      if (d0) {
        called++;
        const lead = daysBetween(d0, r.kevDate);
        allLeads.push(lead);
        if (lead > 0) leads.push(lead);
        actNowEver++;
      }
      if (verdictOn(r, r.kevDate) === "act_now") actNowOnKevDay++;
      if (w0) {
        const wl = daysBetween(w0, r.kevDate);
        if (wl > 0) watchLeads.push(wl);
      }
    }

    // Churn.
    transitions += r.transitions.length;
    let down = 0;
    for (let i = 1; i < r.transitions.length; i++) if (verdictRank(r.transitions[i].verdict) < verdictRank(r.transitions[i - 1].verdict)) down++;
    downgrades += down;
    if (down) cvesWithDowngrade++;
    if (r.transitions.length >= 3) cvesWithThreePlus++;

    // Confusion.
    const peak = peakBeforeConfirmation(r);
    const exploited = !!confirmedAt && confirmedAt <= addDays(r.end, HORIZON_DAYS);
    confusion[peak][exploited ? "exploited" : "notExploited"]++;
  }

  return {
    period: opts.period,
    dataEnd: opts.dataEnd,
    cves: rows.length,
    byStratum: counts,
    actNow: {
      all: finish(act.all, weighted),
      preConfirmation: finish(act.pre, weighted),
      preConfirmation90: finish(act.pre90, weighted),
      postConfirmation: act.post,
      unscoreable: act.unscoreable,
      byStratum: { kev: finish(act.byStratum.kev, false), signal: finish(act.byStratum.signal, false), random: finish(act.byStratum.random, false) },
    },
    low: {
      hold: finish(low.hold, weighted),
      byStratum: { kev: finish(low.byStratum.kev, false), signal: finish(low.byStratum.signal, false), random: finish(low.byStratum.random, false) },
      missed: low.missed,
    },
    watch: { hit90: finish(watch.hit90, weighted) },
    leadTime: {
      kevInPeriod,
      called,
      calledBeforeKev: leads.length,
      shareBeforeKev: kevInPeriod ? leads.length / kevInPeriod : undefined,
      medianAll: median(allLeads),
      medianPreKev: median(leads),
      meanPreKev: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : undefined,
      leads,
      watchCalledBeforeKev: watchLeads.length,
      medianWatchLead: median(watchLeads),
    },
    coverage: {
      kevInPeriod,
      actNowOnKevDay,
      actNowEver,
      rateOnKevDay: kevInPeriod ? actNowOnKevDay / kevInPeriod : undefined,
      rateEver: kevInPeriod ? actNowEver / kevInPeriod : undefined,
    },
    churn: {
      transitionsPerCve: rows.length ? transitions / rows.length : 0,
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
  for (const s of strata) {
    const n = ds.sampling.sampled[s];
    out[s] = n ? ds.sampling.population[s] / n : 1;
  }
  return out;
}

export function datasetAnchors(ds: BacktestDataset): Record<string, string | undefined> {
  return Object.fromEntries(ds.cves.map((c) => [c.cveId, c.published]));
}
