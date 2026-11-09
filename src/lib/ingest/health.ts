import { and, desc, eq, gte, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "./db";

/** A source is failing after this many errors in a row. */
export const FAILING_AFTER = 3;
/** A source is stale when its last success is older than this many intervals (and at least STALE_MIN_MS). */
export const STALE_INTERVALS = 3;
export const STALE_MIN_MS = 3 * 60 * 60_000;

export type HealthState = "ok" | "failing" | "stale" | "unconfigured";

export interface SourceHealthInput {
  id: string;
  name: string;
  intervalMinutes: number;
  lastSuccessAt: Date | null;
  lastError: string | null;
  /** Statuses of the newest runs, newest first ("ok" | "error" | "running"). */
  recent: string[];
}

export interface SourceHealth {
  id: string;
  name: string;
  state: HealthState;
  /** One plain sentence for the alert. Empty when the source is healthy. */
  reason: string;
  /** ISO time of the last successful run, when known. Shown on /status.json. */
  lastSuccessAt?: string | null;
  /** How often the source should run, when known. */
  intervalMinutes?: number;
}

function hours(ms: number): string {
  const h = Math.round(ms / 3_600_000);
  return h === 1 ? "1 hour" : `${h} hours`;
}

/**
 * Judges each enabled source. A source that has never run (for example, one skipped for a missing
 * API key) is "unconfigured" and never alerts. Errors in a row beat staleness as the reason.
 */
export function assessHealth(sources: SourceHealthInput[], now: Date = new Date()): SourceHealth[] {
  return sources.map((s): SourceHealth => {
    const base = { id: s.id, name: s.name, lastSuccessAt: s.lastSuccessAt ? s.lastSuccessAt.toISOString() : null, intervalMinutes: s.intervalMinutes };
    const finished = s.recent.filter((r) => r !== "running");
    if (!s.lastSuccessAt && finished.length === 0) return { ...base, state: "unconfigured", reason: "" };
    let streak = 0;
    for (const r of finished) {
      if (r !== "error") break;
      streak += 1;
    }
    if (streak >= FAILING_AFTER) {
      const err = s.lastError ? ` Last error: ${s.lastError.slice(0, 300)}` : "";
      return { ...base, state: "failing", reason: `The last ${streak} runs failed.${err}` };
    }
    const limit = Math.max(STALE_MIN_MS, STALE_INTERVALS * s.intervalMinutes * 60_000);
    const age = s.lastSuccessAt ? now.getTime() - s.lastSuccessAt.getTime() : Infinity;
    if (age > limit) {
      const since = s.lastSuccessAt ? `No successful run in ${hours(age)}` : "No successful run yet";
      return { ...base, state: "stale", reason: `${since}; it should run every ${s.intervalMinutes} minutes.` };
    }
    return { ...base, state: "ok", reason: "" };
  });
}

/** Loads enabled sources with their newest runs and judges them. */
export async function loadSourceHealth(db: Db, now: Date = new Date()): Promise<SourceHealth[]> {
  const rows = await db.select().from(schema.sources).where(eq(schema.sources.enabled, true));
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const runs = await db
    .select({ sourceId: schema.sourceRuns.sourceId, status: schema.sourceRuns.status })
    .from(schema.sourceRuns)
    .where(and(gte(schema.sourceRuns.startedAt, since)))
    .orderBy(desc(schema.sourceRuns.startedAt));
  const bySource = new Map<string, string[]>();
  for (const r of runs) {
    const list = bySource.get(r.sourceId) ?? [];
    if (list.length < 10) list.push(r.status);
    bySource.set(r.sourceId, list);
  }
  return assessHealth(
    rows.map((s) => ({
      id: s.id,
      name: s.name,
      intervalMinutes: s.intervalMinutes,
      lastSuccessAt: s.lastSuccessAt,
      lastError: s.lastError,
      recent: bySource.get(s.id) ?? [],
    })),
    now,
  );
}

export const EVENTS_SYNC_KEY = "ops.events_sync";
/** The events sync runs every 30 minutes with ingest; it is stale after two missed runs. */
export const EVENTS_SYNC_STALE_MS = 75 * 60_000;

/** What the settings row for the events sync holds. `lastAttemptAt` is the last run, success or not. */
export interface EventsSyncRecord {
  lastSuccessAt?: string | null;
  lastAttemptAt?: string | null;
  failures?: number;
  lastError?: string;
}

/** Records the result of an events sync run in settings, for the health check. */
export async function recordEventsSync(db: Db, ok: boolean, error?: string, now: Date = new Date()): Promise<void> {
  const prev = await db.select().from(schema.settings).where(eq(schema.settings.key, EVENTS_SYNC_KEY));
  const before = (prev[0]?.value ?? {}) as EventsSyncRecord;
  const value: EventsSyncRecord = ok
    ? { lastSuccessAt: now.toISOString(), lastAttemptAt: now.toISOString(), failures: 0 }
    : { lastSuccessAt: before.lastSuccessAt ?? null, lastAttemptAt: now.toISOString(), failures: (before.failures ?? 0) + 1, lastError: (error ?? "").slice(0, 500) };
  await db
    .insert(schema.settings)
    .values({ key: EVENTS_SYNC_KEY, value, updatedAt: now })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: sql`now()` } });
}

/** Health of the events sync job itself, in the same shape as a source. */
export function assessEventsSync(value: EventsSyncRecord | undefined, now: Date = new Date()): SourceHealth {
  const base = { id: "events-sync", name: "Event builder (events sync)", lastSuccessAt: value?.lastSuccessAt ?? null, intervalMinutes: 30 };
  if (!value) return { ...base, state: "unconfigured", reason: "" };
  if ((value.failures ?? 0) >= FAILING_AFTER) {
    return { ...base, state: "failing", reason: `The last ${value.failures} runs failed.${value.lastError ? ` Last error: ${value.lastError.slice(0, 300)}` : ""}` };
  }
  const last = value.lastSuccessAt ? Date.parse(value.lastSuccessAt) : NaN;
  if (!Number.isFinite(last) || now.getTime() - last > EVENTS_SYNC_STALE_MS) {
    return { ...base, state: "stale", reason: "No successful run in the last 75 minutes; it should run every 30 minutes." };
  }
  return { ...base, state: "ok", reason: "" };
}

export async function loadEventsSyncRecord(db: Db): Promise<EventsSyncRecord | undefined> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, EVENTS_SYNC_KEY));
  return rows[0]?.value as EventsSyncRecord | undefined;
}

export async function loadEventsSyncHealth(db: Db, now: Date = new Date()): Promise<SourceHealth> {
  return assessEventsSync(await loadEventsSyncRecord(db), now);
}

/** Neon's free plan stores 0.5 GB per project. Alert at 80% so there is time to prune or upgrade. */
export const DB_LIMIT_BYTES = Number(process.env.STP_DB_LIMIT_BYTES ?? 512 * 1024 * 1024);
export const DB_ALERT_RATIO = 0.8;

export function assessDbSize(bytes: number, limit: number = DB_LIMIT_BYTES): SourceHealth {
  const base = { id: "database-size", name: "Database storage" };
  const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
  if (bytes >= limit * DB_ALERT_RATIO) {
    return { ...base, state: "failing", reason: `The database uses ${mb(bytes)} of ${mb(limit)} (${Math.round((bytes / limit) * 100)}%). Prune old observations or raise the plan before it fills.` };
  }
  return { ...base, state: "ok", reason: "" };
}

export async function loadDbSizeHealth(db: Db): Promise<SourceHealth> {
  const rows = (await db.execute(sql`select pg_database_size(current_database())::bigint as bytes`)) as unknown as { rows?: { bytes: string | number }[] } | { bytes: string | number }[];
  const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
  return assessDbSize(Number(list[0]?.bytes ?? 0));
}
