import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { Db } from "@/lib/ingest/db";
import { latestReports, period, type BacktestReport } from "@/lib/admin/backtest";
import type { RateCell } from "@/lib/backtest/score";
import { EARLY_PREFIX } from "@/lib/ladder/events";
import { CURRENT_RULES_VERSION, RULES } from "@/lib/ladder/rules";
import { RULES_CHANGELOG } from "@/lib/ladder/rules/changelog";
import { SITE_URL } from "@/lib/site";
import { scoreLive, type CveHistory, type LiveRecord, type ScoredCall } from "./score";

export * from "./score";

export interface PublishedCall extends ScoredCall {
  title: string;
  /** The event page a reader should open: the call's own event if visible, else the visible event naming the CVE. Null when neither is visible. */
  url: string | null;
}

export interface BacktestRate {
  rate: number;
  ci: [number, number] | null;
  hits: number;
  n: number;
}

export interface VersionBacktest {
  /** The report the numbers come from. For a version that keeps another's verdicts, that version's report. */
  reportVersion: string;
  window: { from: string; to: string };
  heldOut: { from: string; to: string };
  /** Act now before confirmation, right within 30 days. Population weighted. */
  actNowAll: BacktestRate | null;
  actNowHeldOut: BacktestRate | null;
  /** KEV additions with an Act now before the listing day, whole window. */
  kevCalledBefore: BacktestRate | null;
  medianLeadDays: number | null;
}

export interface VersionRow {
  version: string;
  released: string | null;
  active: boolean;
  /** Set when the version keeps another version's verdicts. */
  verdictsFrom: string | null;
  summary: string | null;
  backtest: VersionBacktest | null;
}

export interface TrackRecord {
  rulesVersion: string;
  live: Omit<LiveRecord, "actNow"> & { actNow: Omit<LiveRecord["actNow"], "calls"> & { calls: PublishedCall[] } };
  versions: VersionRow[];
}

const rateOf = (c: RateCell | undefined): BacktestRate | null => {
  if (!c || !c.n) return null;
  const rate = c.weightedRate ?? c.rate;
  if (rate === undefined) return null;
  return { rate, ci: c.weightedCi ?? c.ci ?? null, hits: c.hits, n: c.n };
};

export function versionBacktest(r: BacktestReport | undefined): VersionBacktest | null {
  if (!r) return null;
  const all = period(r, "all");
  const held = period(r, "held-out");
  return {
    reportVersion: r.rulesVersion,
    window: { from: r.window.from, to: r.window.to },
    heldOut: { from: held?.period.from ?? r.window.split, to: held?.period.to ?? r.window.to },
    actNowAll: rateOf(all?.actNow.preConfirmation),
    actNowHeldOut: rateOf(held?.actNow.preConfirmation),
    kevCalledBefore: rateOf(all?.leadTime.shareBeforeKev),
    medianLeadDays: all?.leadTime.medianPreKev ?? null,
  };
}

/** Every rules version, newest first, with its backtest (or its base version's when it keeps those verdicts). */
export function versionRows(reports: Record<string, BacktestReport>): VersionRow[] {
  return Object.keys(RULES)
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))
    .map((v) => {
      const from = RULES[v].verdictsFrom ?? null;
      const change = RULES_CHANGELOG.find((c) => c.version === v);
      return {
        version: v,
        released: change?.date ?? null,
        active: v === CURRENT_RULES_VERSION,
        verdictsFrom: from,
        summary: change?.summary ?? null,
        backtest: versionBacktest(reports[v] ?? (from ? reports[from] : undefined)),
      };
    });
}

interface HistRow {
  event_id: string;
  verdict: string;
  rules_version: string;
  changed_at: string | Date;
}
const rowsOf = <T>(res: unknown): T[] => (res as { rows?: T[] }).rows ?? (res as T[]);

/** Rules history grouped by CVE, with each CVE's earliest KEV listing day. */
export async function loadCveHistories(db: Db): Promise<{ cves: CveHistory[]; events: Map<string, { title: string; hidden: boolean }>; visibleOwner: Map<string, string> }> {
  const [hist, links, evs] = await Promise.all([
    db.execute(sql`select event_id, verdict, rules_version, changed_at from verdict_history where actor = 'rules'`),
    db.execute(sql`select event_id, upper(cve_id) as cve_id from event_cves`),
    db.execute(sql`select id, coalesce(title_override, title) as title, hidden from events`),
  ]);
  const events = new Map(rowsOf<{ id: string; title: string; hidden: boolean }>(evs).map((e) => [e.id, { title: e.title, hidden: e.hidden }]));
  // Which CVEs each event named. An early event loses its CVE link when a KEV event adopts the
  // CVE, but its id still names it, so the call it made stays on the record.
  const cvesOf = new Map<string, Set<string>>();
  const link = (eventId: string, cve: string) => cvesOf.set(eventId, (cvesOf.get(eventId) ?? new Set()).add(cve));
  const visibleOwner = new Map<string, string>();
  for (const l of rowsOf<{ event_id: string; cve_id: string }>(links)) {
    link(l.event_id, l.cve_id);
    if (events.get(l.event_id)?.hidden === false && !visibleOwner.has(l.cve_id)) visibleOwner.set(l.cve_id, l.event_id);
  }
  for (const id of events.keys()) if (id.startsWith(EARLY_PREFIX)) link(id, id.slice(EARLY_PREFIX.length).toUpperCase());

  const byCve = new Map<string, CveHistory>();
  for (const h of rowsOf<HistRow>(hist)) {
    for (const cve of cvesOf.get(h.event_id) ?? []) {
      const c = byCve.get(cve) ?? { cveId: cve, rows: [], kevDate: null };
      c.rows.push({ eventId: h.event_id, verdict: h.verdict, rulesVersion: h.rules_version, at: new Date(h.changed_at) });
      byCve.set(cve, c);
    }
  }
  const ids = [...byCve.keys()];
  if (ids.length) {
    const kev = await db.execute(sql`
      select upper(cve_id) as cve_id, kev_cisa_date_added as cisa, kev_vulncheck_date_added as vulncheck
      from vulnerabilities where upper(cve_id) in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    for (const k of rowsOf<{ cve_id: string; cisa: string | null; vulncheck: string | null }>(kev)) {
      const dates = [k.cisa, k.vulncheck].filter((d): d is string => !!d).map((d) => d.slice(0, 10)).sort();
      const c = byCve.get(k.cve_id);
      if (c && dates.length) c.kevDate = dates[0];
    }
  }
  return { cves: [...byCve.values()], events, visibleOwner };
}

/** The live record plus the backtest per rules version. Null without a database. */
export async function getTrackRecord(now: Date = new Date()): Promise<TrackRecord | null> {
  const neon = getDb();
  if (!neon) return null;
  const db = neon as unknown as Db;
  const [{ cves, events, visibleOwner }, reports] = await Promise.all([loadCveHistories(db), latestReports()]);
  return buildTrackRecord(scoreLive(cves, now), events, visibleOwner, reports);
}

export function buildTrackRecord(
  live: LiveRecord,
  events: Map<string, { title: string; hidden: boolean }>,
  visibleOwner: Map<string, string>,
  reports: Record<string, BacktestReport>,
): TrackRecord {
  const calls: PublishedCall[] = live.actNow.calls.map((c) => {
    const target = events.get(c.eventId)?.hidden === false ? c.eventId : (visibleOwner.get(c.cveId) ?? null);
    return { ...c, title: events.get(target ?? c.eventId)?.title ?? c.cveId, url: target ? `${SITE_URL}/events/${target}` : null };
  });
  return { rulesVersion: CURRENT_RULES_VERSION, live: { ...live, actNow: { ...live.actNow, calls } }, versions: versionRows(reports) };
}
