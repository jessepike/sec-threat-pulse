import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db/client";
import { ensureMigrated } from "@/lib/db/migrate";
import { runDueSources, seedSources, type SourceRunSummary } from "@/lib/ingest/runner";
import { runEventsSync } from "@/lib/ingest/events-run";
import type { Db } from "@/lib/ingest/db";
import { checkCronAuth } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingest may use its whole budget and the events sync follows in the same invocation.
export const maxDuration = 420;

/** Stop starting new sources after this long, leaving room to finish the one in flight. */
const BUDGET_MS = 210_000;

/**
 * The one scheduled run (every 30 minutes, see vercel.json): ingest every due source, then rebuild
 * events. One invocation wakes the database once; two crons seven minutes apart kept it awake most
 * of the hour and used up the free compute allowance. No source has an interval under 30 minutes.
 *
 * The events sync runs even when ingest fails or finds nothing new, because verdicts depend on the
 * date as well as on evidence. Alerts are no longer opened here: the outside probe reads
 * /status.json and owns every alert issue (scripts/ops/freshness-probe.mjs).
 */
async function handle(req: Request): Promise<Response> {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const db = getDb() as Db | null;
  if (!db) return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    await ensureMigrated();
  } catch (e) {
    return Response.json({ ok: false, error: `Migration failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const url = new URL(req.url);
  const only = url.searchParams.get("only")?.split(",").filter(Boolean);
  const force = url.searchParams.get("force") === "1";
  const withEvents = url.searchParams.get("events") !== "0";
  const started = Date.now();

  let sources: SourceRunSummary[] = [];
  let ingestError: string | undefined;
  try {
    await seedSources(db);
    sources = await runDueSources(db, { only, force: force || !!only, budgetMs: BUDGET_MS });
  } catch (e) {
    ingestError = e instanceof Error ? e.message : String(e);
  }

  const events = withEvents ? await runEventsSync(db) : null;
  // Public pages read through unstable_cache tagged "stp"; expire it so new data shows at once.
  if (events?.ok || sources.some((s) => s.observationsNew > 0)) revalidateTag("stp", { expire: 0 });

  const ran = sources.filter((s) => s.status === "ok" || s.status === "error");
  const ok = !ingestError && (events ? events.ok : true);
  return Response.json(
    {
      ok,
      durationMs: Date.now() - started,
      ...(ingestError ? { error: ingestError } : {}),
      ran: ran.length,
      failed: sources.filter((s) => s.status === "error").map((s) => ({ sourceId: s.sourceId, error: s.error })),
      newObservations: sources.reduce((n, s) => n + s.observationsNew, 0),
      events,
      sources,
    },
    { status: ok ? 200 : 500 },
  );
}

export const GET = handle;
export const POST = handle;
