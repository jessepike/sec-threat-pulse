import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { schema } from "@/lib/db/client";
import type { Db } from "./db";

const { sources, sourceRuns, events, observations, auditLog, corrections, verdictHistory, eventCves } = schema;

export interface AlertRow {
  sourceId: string;
  name: string;
  reason: string;
}

/** Alerts are derived: 2+ consecutive failed runs, or no success in 3x the interval. */
export async function openAlerts(db: Db, now = new Date()): Promise<AlertRow[]> {
  const srcs = await db.select().from(sources).where(eq(sources.enabled, true));
  const runs = await db
    .select({ sourceId: sourceRuns.sourceId, status: sourceRuns.status })
    .from(sourceRuns)
    .orderBy(desc(sourceRuns.startedAt))
    .limit(500);
  const out: AlertRow[] = [];
  for (const s of srcs) {
    let streak = 0;
    for (const r of runs) {
      if (r.sourceId !== s.id || r.status === "running") continue;
      if (r.status === "error") streak++;
      else break;
    }
    if (streak >= 2) out.push({ sourceId: s.id, name: s.name, reason: `${streak} failed runs in a row` });
    else if (s.lastRunAt && (!s.lastSuccessAt || now.getTime() - s.lastSuccessAt.getTime() > s.intervalMinutes * 3 * 60_000)) {
      out.push({ sourceId: s.id, name: s.name, reason: "No success in 3 intervals" });
    }
  }
  return out;
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
  const alerts = await openAlerts(db);
  return { lastRun, failing, verdicts, hidden: hidden?.n ?? 0, recent, alerts };
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

export async function listEvents(db: Db, f: { q?: string; verdict?: string; hidden?: boolean }) {
  const q = f.q?.trim();
  const where = and(
    q ? or(ilike(events.title, `%${q}%`), ilike(events.titleOverride, `%${q}%`), ilike(events.id, `%${q}%`)) : undefined,
    f.verdict ? sql`coalesce(${events.overrideVerdict}, ${events.verdict}) = ${f.verdict}` : undefined,
    f.hidden === undefined ? undefined : eq(events.hidden, f.hidden),
  );
  return db.select().from(events).where(where).orderBy(desc(events.updatedAt)).limit(100);
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
