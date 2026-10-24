import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { checkCronAuth } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Applies pending Drizzle migrations from ./drizzle. Protected by CRON_SECRET and not scheduled:
 * the lead calls it once after a schema change ships, so the database URL never leaves Vercel.
 * Migrations are idempotent (Drizzle records applied ones in __drizzle_migrations).
 */
async function handle(req: Request): Promise<Response> {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const started = Date.now();
  try {
    await migrate(drizzle(neon(url)), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    return Response.json({ ok: true, durationMs: Date.now() - started });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const POST = handle;
