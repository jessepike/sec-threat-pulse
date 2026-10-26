import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db/client";
import { ensureMigrated } from "@/lib/db/migrate";
import type { Db } from "@/lib/ingest/db";
import { syncEvents } from "@/lib/ladder/events-sync";
import { recordEventsSync } from "@/lib/ingest/health";
import { checkCronAuth } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  const started = Date.now();
  try {
    const summary = await syncEvents(db, Number.isFinite(lookback) && lookback > 0 ? { lookbackDays: lookback } : {});
    // Public pages read through unstable_cache tagged "stp"; expire it so new events show at once.
    revalidateTag("stp", { expire: 0 });
    await recordEventsSync(db, true).catch(() => undefined);
    return Response.json({ ok: true, durationMs: Date.now() - started, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordEventsSync(db, false, message).catch(() => undefined);
    return Response.json({ ok: false, error: message, durationMs: Date.now() - started }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
