import { count, gte, max, sql } from "drizzle-orm";
import { corrections, observations, sourceRuns, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";

const DAY = 86400000;

export interface FreshnessRow {
  sourceId: string;
  name: string;
  enabled: boolean;
  intervalMinutes: number;
  okRuns: number;
  errorRuns: number;
  /** Successful runs per day over the window. */
  runsPerDay: number;
  lastSuccessAt: Date | null;
  /** Newest observation stored for this source. */
  newestObservationAt: Date | null;
}

/** Runs per day and newest data age for every source over the last `days` days. */
export async function freshness(db: Db, now = new Date(), days = 7): Promise<{ rows: FreshnessRow[]; pipelineRunsPerDay: number }> {
  const since = new Date(now.getTime() - days * DAY);
  const [srcs, runs, newest] = await Promise.all([
    db.select().from(sources).orderBy(sources.id),
    db
      .select({
        sourceId: sourceRuns.sourceId,
        ok: sql<number>`count(*) filter (where ${sourceRuns.status} = 'ok')::int`,
        error: sql<number>`count(*) filter (where ${sourceRuns.status} = 'error')::int`,
      })
      .from(sourceRuns)
      .where(gte(sourceRuns.startedAt, since))
      .groupBy(sourceRuns.sourceId),
    db.select({ sourceId: observations.sourceId, at: max(observations.observedAt) }).from(observations).groupBy(observations.sourceId),
  ]);
  const runOf = new Map(runs.map((r) => [r.sourceId, r]));
  const newestOf = new Map(newest.map((r) => [r.sourceId, r.at]));
  const rows = srcs.map((s) => {
    const r = runOf.get(s.id);
    return {
      sourceId: s.id,
      name: s.name,
      enabled: s.enabled,
      intervalMinutes: s.intervalMinutes,
      okRuns: r?.ok ?? 0,
      errorRuns: r?.error ?? 0,
      runsPerDay: (r?.ok ?? 0) / days,
      lastSuccessAt: s.lastSuccessAt,
      newestObservationAt: newestOf.get(s.id) ?? null,
    };
  });
  const total = runs.reduce((a, r) => a + r.ok, 0);
  return { rows, pipelineRunsPerDay: total / days };
}

export interface Coverage {
  kevAdditions: number;
  withEvent: number;
}

/** KEV additions in the last `days` days, and how many have a visible event. */
export async function kevCoverage(db: Db, now = new Date(), days = 30): Promise<Coverage> {
  const from = new Date(now.getTime() - days * DAY).toISOString().slice(0, 10);
  const res = await db.execute(sql`
    select count(*)::int as total,
           count(*) filter (where exists (
             select 1 from event_cves ec join events e on e.id = ec.event_id
             where upper(ec.cve_id) = upper(v.cve_id) and e.hidden = false
           ))::int as covered
    from vulnerabilities v
    where left(least(v.kev_cisa_date_added, v.kev_vulncheck_date_added), 10) >= ${from}`);
  const rows = (res as unknown as { rows?: { total: number; covered: number }[] }).rows ?? (res as unknown as { total: number; covered: number }[]);
  return { kevAdditions: Number(rows[0]?.total ?? 0), withEvent: Number(rows[0]?.covered ?? 0) };
}

export interface Trust {
  observations: number;
  withUrl: number;
  correctionsTotal: number;
  corrections30d: number;
}

/** Share of observations with a source link, and the corrections log counts. */
export async function trust(db: Db, now = new Date()): Promise<Trust> {
  const since = new Date(now.getTime() - 30 * DAY);
  const [obs] = await db
    .select({ n: count(), withUrl: sql<number>`count(*) filter (where ${observations.url} ~* '^https?://')::int` })
    .from(observations);
  const [total] = await db.select({ n: count() }).from(corrections);
  const [recent] = await db.select({ n: count() }).from(corrections).where(gte(corrections.createdAt, since));
  return { observations: Number(obs?.n ?? 0), withUrl: Number(obs?.withUrl ?? 0), correctionsTotal: Number(total?.n ?? 0), corrections30d: Number(recent?.n ?? 0) };
}

