// Live track record: how the verdicts the site published held up. Pure, no I/O.
//
// Mirrors the backtest's headline measure (lib/backtest/score.ts) on live history:
// - The unit is a CVE, as in the backtest. A CVE's call is the first time the rules put any event
//   naming it at Act now (or at Watch or higher, for the Watch measure). Admin overrides are not
//   scored: the record is of the rules.
// - Before its listing, a CVE can only be named by its own early event (`early-<cve>`): KEV
//   clusters form at listing time and gain CVEs as they are listed, and event_cves does not say
//   when a CVE joined. So a row from any other event counts for a CVE only on or after the CVE's
//   listing day, where it is never scored. This keeps a cluster's early call from being credited
//   to CVEs that joined it later.
// - Ground truth is a KEV listing (CISA or VulnCheck), the earliest of the two. A call made on or
//   after the listing day is true by construction and is counted apart, never scored.
// - A call before the listing is right when the listing came within the horizon (30 days for Act
//   now, 90 for Watch), wrong when the horizon passed with no listing, and pending until then.

import { wilson } from "@/lib/backtest/score";
import { daysBetween } from "@/lib/backtest/replay";

export const ACT_NOW_HORIZON_DAYS = 30;
export const WATCH_HORIZON_DAYS = 90;

export interface HistoryRow {
  eventId: string;
  verdict: string;
  rulesVersion: string;
  at: Date;
}

export interface CveHistory {
  cveId: string;
  /** Rules rows of every event that named the CVE, any order. */
  rows: HistoryRow[];
  /** Earliest KEV listing day, YYYY-MM-DD, or null. */
  kevDate: string | null;
}

export type Outcome = "right" | "wrong" | "pending";

export interface ScoredCall {
  cveId: string;
  eventId: string;
  rulesVersion: string;
  /** UTC day of the call. */
  calledOn: string;
  kevDate: string | null;
  outcome: Outcome;
  /** Days from the call to the listing, for right calls. */
  leadDays: number | null;
  /** Day the outcome is settled if no listing comes, for pending calls. */
  settlesOn: string | null;
}

export interface RecordCell {
  /** Calls made before any confirmation. */
  calls: number;
  right: number;
  wrong: number;
  pending: number;
  /** right / (right + wrong); undefined while nothing is settled. */
  rate?: number;
  /** 95% Wilson interval on rate. */
  ci?: [number, number];
  medianLeadDays?: number;
}

export interface LiveRecord {
  /** First day of live history. */
  since: string;
  asOf: string;
  actNow: { overall: RecordCell; byVersion: Record<string, RecordCell>; postConfirmation: number; calls: ScoredCall[] };
  watch: { overall: RecordCell; byVersion: Record<string, RecordCell> };
  /** KEV listings after live history began, and how many had an Act now from us before the listing day. */
  kevCoverage: { listings: number; calledBefore: number; share?: number; ci?: [number, number]; medianLeadDays?: number };
}

/** Whether a history row can stand for a call on this CVE (see the note at the top). */
export function attributable(row: Pick<HistoryRow, "eventId" | "at">, cveId: string, kevDate: string | null): boolean {
  if (row.eventId.toLowerCase() === `early-${cveId.toLowerCase()}`) return true;
  return kevDate !== null && row.at.toISOString().slice(0, 10) >= kevDate;
}

const RANK: Record<string, number> = { low: 0, watch: 1, act_now: 2 };
const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** First rules row at or above a verdict, earliest first; ties broken by event id for a stable result. */
export function firstCall(rows: HistoryRow[], atLeast: "act_now" | "watch"): HistoryRow | undefined {
  return rows
    .filter((r) => (RANK[r.verdict] ?? -1) >= RANK[atLeast])
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.eventId.localeCompare(b.eventId))[0];
}

/** Scores one call. Returns null for a call made on or after the listing day (true by construction). */
export function scoreCall(cveId: string, call: HistoryRow, kevDate: string | null, today: string, horizon: number): ScoredCall | null {
  const calledOn = utcDay(call.at);
  const base = { cveId, eventId: call.eventId, rulesVersion: call.rulesVersion, calledOn, kevDate };
  if (kevDate && kevDate <= calledOn) return null;
  if (kevDate && daysBetween(calledOn, kevDate) <= horizon) return { ...base, outcome: "right", leadDays: daysBetween(calledOn, kevDate), settlesOn: null };
  const settlesOn = addDays(calledOn, horizon);
  // Settled wrong once the whole horizon has passed with no listing inside it.
  if (today > settlesOn) return { ...base, outcome: "wrong", leadDays: null, settlesOn: null };
  return { ...base, outcome: "pending", leadDays: null, settlesOn };
}

function cell(calls: ScoredCall[]): RecordCell {
  const right = calls.filter((c) => c.outcome === "right").length;
  const wrong = calls.filter((c) => c.outcome === "wrong").length;
  const pending = calls.length - right - wrong;
  const settled = right + wrong;
  return {
    calls: calls.length,
    right,
    wrong,
    pending,
    rate: settled ? right / settled : undefined,
    ci: wilson(right, settled),
    medianLeadDays: median(calls.flatMap((c) => (c.leadDays === null ? [] : [c.leadDays]))),
  };
}

function byVersion(calls: ScoredCall[]): Record<string, RecordCell> {
  const groups = new Map<string, ScoredCall[]>();
  for (const c of calls) groups.set(c.rulesVersion, [...(groups.get(c.rulesVersion) ?? []), c]);
  return Object.fromEntries([...groups.keys()].sort().map((v) => [v, cell(groups.get(v)!)]));
}

export function scoreLive(cves: CveHistory[], now: Date = new Date()): LiveRecord {
  const today = utcDay(now);
  const allRows = cves.flatMap((c) => c.rows);
  const since = allRows.length ? utcDay(new Date(Math.min(...allRows.map((r) => r.at.getTime())))) : today;

  const act: ScoredCall[] = [];
  const watch: ScoredCall[] = [];
  let postConfirmation = 0;
  let listings = 0;
  const coverageLeads: number[] = [];
  for (const raw of cves) {
    const c = { ...raw, rows: raw.rows.filter((r) => attributable(r, raw.cveId, raw.kevDate)) };
    const a = firstCall(c.rows, "act_now");
    if (a) {
      const s = scoreCall(c.cveId, a, c.kevDate, today, ACT_NOW_HORIZON_DAYS);
      if (s) act.push(s);
      else postConfirmation++;
    }
    const w = firstCall(c.rows, "watch");
    if (w) {
      const s = scoreCall(c.cveId, w, c.kevDate, today, WATCH_HORIZON_DAYS);
      if (s) watch.push(s);
    }
    // Listings after the first day of history: on day one every listing predates the site.
    if (c.kevDate && c.kevDate > since && c.kevDate <= today) {
      listings++;
      if (a && utcDay(a.at) < c.kevDate) coverageLeads.push(daysBetween(utcDay(a.at), c.kevDate));
    }
  }
  act.sort((x, y) => y.calledOn.localeCompare(x.calledOn) || x.cveId.localeCompare(y.cveId));
  return {
    since,
    asOf: now.toISOString(),
    actNow: { overall: cell(act), byVersion: byVersion(act), postConfirmation, calls: act },
    watch: { overall: cell(watch), byVersion: byVersion(watch) },
    kevCoverage: {
      listings,
      calledBefore: coverageLeads.length,
      share: listings ? coverageLeads.length / listings : undefined,
      ci: wilson(coverageLeads.length, listings),
      medianLeadDays: median(coverageLeads),
    },
  };
}
