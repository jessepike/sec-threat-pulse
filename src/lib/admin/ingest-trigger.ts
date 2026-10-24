import { eq } from "drizzle-orm";
import { schema } from "@/lib/db/client";
import { writeAudit } from "./audit";
import type { Db } from "./db";

export const SOURCE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export type TriggerResult = { ok: true; status: number; summary: string } | { ok: false; error: string };

/**
 * Runs one source now by calling the cron ingest route with CRON_SECRET, server side.
 * Swap for the shared runner in src/lib/ingest/runner.ts once it exists.
 */
export async function triggerIngest(
  origin: string,
  sourceId: string,
  opts: { secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<TriggerResult> {
  if (!SOURCE_ID.test(sourceId)) return { ok: false, error: "Invalid source id." };
  const secret = opts.secret ?? process.env.CRON_SECRET;
  if (!secret) return { ok: false, error: "CRON_SECRET is not set on the server." };
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${origin}/api/cron/ingest?only=${encodeURIComponent(sourceId)}&force=1`, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const text = (await res.text()).slice(0, 300);
    if (!res.ok) return { ok: false, error: `Ingest route answered ${res.status}. ${text}` };
    return { ok: true, status: res.status, summary: text };
  } catch (e) {
    return { ok: false, error: `Could not reach the ingest route: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}

/** Checks the source exists, triggers the run and writes the audit row. */
export async function runSourceNow(db: Db, actor: string, origin: string, sourceId: string): Promise<TriggerResult> {
  if (!SOURCE_ID.test(sourceId)) return { ok: false, error: "Invalid source id." };
  const [src] = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.id, sourceId));
  if (!src) return { ok: false, error: "Unknown source." };
  const result = await triggerIngest(origin, sourceId);
  await writeAudit(db, {
    actor,
    action: "source.run_now",
    target: sourceId,
    details: result.ok ? { ok: true } : { ok: false, error: result.error },
  });
  return result;
}
