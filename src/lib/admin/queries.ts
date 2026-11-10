import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { schema } from "@/lib/db/client";
import type { Db } from "./db";
import type { Db as IngestDb } from "@/lib/ingest/db";
import { loadDbSizeHealth, loadEventsSyncHealth, loadSourceHealth } from "@/lib/ingest/health";

const { sources, sourceRuns, events, observations, auditLog, corrections, verdictHistory, eventCves } = schema;

export interface AlertRow {
  sourceId: string;
  name: string;
  reason: string;
}

/**
 * Open alerts use the same health check that opens GitHub alert issues after each ingest run:
 * failing or stale sources, the events cron, and database storage.
 */
export async function openAlerts(db: Db, now = new Date()): Promise<AlertRow[]> {
  const [srcs, eventsSync, dbSize] = await Promise.all([
    loadSourceHealth(db as unknown as IngestDb, now),
    loadEventsSyncHealth(db as unknown as IngestDb, now),
    loadDbSizeHealth(db as unknown as IngestDb).catch(() => null),
  ]);
  return [...srcs, eventsSync, ...(dbSize ? [dbSize] : [])]
    .filter((h) => h.state === "failing" || h.state === "stale")
    .map((h) => ({ sourceId: h.id, name: h.name, reason: h.reason }));
}

/** Database size in bytes, for the overview. */
export async function databaseBytes(db: Db): Promise<number | null> {
  try {
    const rows = (await db.execute(sql`select pg_database_size(current_database())::bigint as bytes`)) as unknown as { rows?: { bytes: string | number }[] } | { bytes: string | number }[];
    const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
    return list.length ? Number(list[0].bytes) : null;
  } catch {
    return null;
  }
}

export async function overviewData(db: Db) {
  const [lastRun] = await db
    .select({
      id: sourceRuns.id,
      sourceId: sourceRuns.sourceId,
      status: sourceRuns.status,
      startedAt: sourceRuns.startedAt,
      itemsNew: sourceRuns.itemsNew,
    })
    .from(sourceRuns)
    .orderBy(desc(sourceRuns.startedAt))
    .limit(1);
  const failing = await db
    .select({ id: sources.id, name: sources.name, lastError: sources.lastError, lastRunAt: sources.lastRunAt })
    .from(sources)
    .where(and(eq(sources.enabled, true), sql`${sources.lastError} is not null`));
  const verdicts = await db
    .select({ verdict: sql<string>`coalesce(${events.overrideVerdict}, ${events.verdict})`, n: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.hidden, false))
    .groupBy(sql`coalesce(${events.overrideVerdict}, ${events.verdict})`);
  const [hidden] = await db.select({ n: sql<number>`count(*)::int` }).from(events).where(eq(events.hidden, true));
  const recent = await db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(10);
  const [alerts, dbBytes] = await Promise.all([openAlerts(db), databaseBytes(db)]);
  return { lastRun, failing, verdicts, hidden: hidden?.n ?? 0, recent, alerts, dbBytes };
}

export async function listSources(db: Db) {
  return db.select().from(sources).orderBy(sources.id);
}

export async function listRuns(db: Db, f: { sourceId?: string; status?: string }) {
  const where = and(
    f.sourceId ? eq(sourceRuns.sourceId, f.sourceId) : undefined,
    f.status ? eq(sourceRuns.status, f.status) : undefined,
  );
  return db.select().from(sourceRuns).where(where).orderBy(desc(sourceRuns.startedAt)).limit(200);
}

export const ADMIN_EVENTS_PAGE_SIZE = 50;

/** One page of events, most recently updated first, with the total that matches the filter. */
export async function listEvents(db: Db, f: { q?: string; verdict?: string; hidden?: boolean; page?: number }) {
  const q = f.q?.trim();
  const where = and(
    q ? or(ilike(events.title, `%${q}%`), ilike(events.titleOverride, `%${q}%`), ilike(events.id, `%${q}%`)) : undefined,
    f.verdict ? sql`coalesce(${events.overrideVerdict}, ${events.verdict}) = ${f.verdict}` : undefined,
    f.hidden === undefined ? undefined : eq(events.hidden, f.hidden),
  );
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(events).where(where).orderBy(desc(events.updatedAt), events.id).limit(ADMIN_EVENTS_PAGE_SIZE).offset((page - 1) * ADMIN_EVENTS_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(events).where(where),
  ]);
  return { rows, total: Number(n) };
}

export async function eventDetail(db: Db, id: string) {
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) return null;
  const [obs, cves, history, corr] = await Promise.all([
    db.select().from(observations).where(eq(observations.eventId, id)).orderBy(desc(observations.observedAt)).limit(200),
    db.select().from(eventCves).where(eq(eventCves.eventId, id)),
    db.select().from(verdictHistory).where(eq(verdictHistory.eventId, id)).orderBy(desc(verdictHistory.changedAt)).limit(50),
    db.select().from(corrections).where(eq(corrections.eventId, id)).orderBy(desc(corrections.createdAt)),
  ]);
  return { event, observations: obs, cves: cves.map((c) => c.cveId), history, corrections: corr };
}

export async function listCorrections(db: Db) {
  return db.select().from(corrections).orderBy(desc(corrections.createdAt)).limit(200);
}

export async function listAudit(db: Db, actor?: string) {
  return db
    .select()
    .from(auditLog)
    .where(actor ? eq(auditLog.actor, actor) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(300);
}
