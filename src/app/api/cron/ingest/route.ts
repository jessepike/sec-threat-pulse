import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db/client";
import { runDueSources, seedSources } from "@/lib/ingest/runner";
import type { Db } from "@/lib/ingest/db";
import { checkCronAuth } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Stop starting new sources after this long, leaving room to finish the one in flight. */
const BUDGET_MS = 210_000;

async function handle(req: Request): Promise<Response> {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const db = getDb() as Db | null;
  if (!db) return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 });

  const url = new URL(req.url);
  const only = url.searchParams.get("only")?.split(",").filter(Boolean);
  const force = url.searchParams.get("force") === "1";
  const started = Date.now();
  try {
    await seedSources(db);
    const sources = await runDueSources(db, { only, force: force || !!only, budgetMs: BUDGET_MS });
    if (sources.some((s) => s.observationsNew > 0)) revalidateTag("stp", { expire: 0 });
    const ran = sources.filter((s) => s.status === "ok" || s.status === "error");
    return Response.json({
      ok: true,
      durationMs: Date.now() - started,
      ran: ran.length,
      failed: sources.filter((s) => s.status === "error").map((s) => ({ sourceId: s.sourceId, error: s.error })),
      newObservations: sources.reduce((n, s) => n + s.observationsNew, 0),
      sources,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - started }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
