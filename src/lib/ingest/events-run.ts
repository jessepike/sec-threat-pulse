import { refreshOldTitles, syncEvents, type SyncSummary } from "@/lib/ladder/events-sync";
import type { Db } from "./db";
import { recordEventsSync } from "./health";

export type EventsRunResult =
  | ({ ok: true; durationMs: number; titlesRefreshed: number } & SyncSummary)
  | { ok: false; durationMs: number; error: string };

/**
 * One events sync with its bookkeeping: rebuild events, refresh old titles and record the result
 * for /status.json. Never throws. Both cron routes call this, so a run that follows an ingest and a
 * run started by hand leave the same record.
 */
export async function runEventsSync(db: Db, opts: { lookbackDays?: number } = {}): Promise<EventsRunResult> {
  const started = Date.now();
  try {
    const summary = await syncEvents(db, opts.lookbackDays ? { lookbackDays: opts.lookbackDays } : {});
    const titlesRefreshed = await refreshOldTitles(db).catch(() => 0);
    await recordEventsSync(db, true).catch(() => undefined);
    return { ok: true, durationMs: Date.now() - started, titlesRefreshed, ...summary };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await recordEventsSync(db, false, error).catch(() => undefined);
    return { ok: false, durationMs: Date.now() - started, error };
  }
}
