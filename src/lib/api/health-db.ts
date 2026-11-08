import { desc, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { Db } from "@/lib/ingest/db";
import { assessEventsSync, loadDbSizeHealth, loadEventsSyncRecord, loadSourceHealth } from "@/lib/ingest/health";
import { countVerdicts, loadRecords } from "@/lib/data/db";
import { buildHealth, downReport, type HealthReport } from "./health";

/** Builds the public health report from the live database, or the "down" report without one. */
export async function loadHealth(now: Date = new Date()): Promise<HealthReport> {
  const neonDb = getDb();
  if (!neonDb) return downReport(now);
  const db = neonDb as unknown as Db;
  const [sources, syncRecord, database, recs, lastRun] = await Promise.all([
    loadSourceHealth(db, now),
    loadEventsSyncRecord(db),
    loadDbSizeHealth(db).catch(() => null),
    loadRecords(neonDb),
    db.select({ at: schema.sources.lastRunAt }).from(schema.sources).where(isNotNull(schema.sources.lastRunAt)).orderBy(desc(schema.sources.lastRunAt)).limit(1),
    db.execute(sql`select 1`),
  ]);
  const newest = recs.map((r) => r.evidenceAt).filter((n) => Number.isFinite(n));
  return buildHealth(
    {
      sources,
      eventsSync: assessEventsSync(syncRecord, now),
      eventsSyncAttemptAt: syncRecord?.lastAttemptAt ?? null,
      sourcesAttemptAt: lastRun[0]?.at ? lastRun[0].at.toISOString() : null,
      database,
      counts: countVerdicts(recs.map((r) => ({ verdict: r.verdict }))),
      newestEvidenceAt: newest.length ? new Date(Math.max(...newest)).toISOString() : null,
    },
    now,
  );
}
