import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

let pending: Promise<void> | null = null;

/**
 * Applies pending Drizzle migrations once per server instance. The cron routes call this first, so a
 * schema change ships with its code and needs no manual step. Drizzle records applied migrations in
 * __drizzle_migrations, so repeat calls are cheap no-ops. A failure is retried on the next call.
 */
export function ensureMigrated(url: string | undefined = process.env.DATABASE_URL): Promise<void> {
  if (!url) return Promise.resolve();
  if (!pending) {
    pending = migrate(drizzle(neon(url)), { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch((e) => {
      pending = null;
      throw e;
    });
  }
  return pending;
}
