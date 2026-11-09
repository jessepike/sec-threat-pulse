import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db/client";
import { ensureMigrated } from "@/lib/db/migrate";
import type { Db } from "@/lib/ingest/db";
import { runEventsSync } from "@/lib/ingest/events-run";
import { checkCronAuth } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Rebuilds events on their own. The scheduled run is /api/cron/ingest, which ingests and then
 * rebuilds events in one invocation; this route stays for a rebuild by hand (for example with
 * `?lookbackDays=`) and is not on a schedule.
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

  const lookback = Number(new URL(req.url).searchParams.get("lookbackDays"));
  const result = await runEventsSync(db, Number.isFinite(lookback) && lookback > 0 ? { lookbackDays: lookback } : {});
  // Public pages read through unstable_cache tagged "stp"; expire it so new events show at once.
  if (result.ok) revalidateTag("stp", { expire: 0 });
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
