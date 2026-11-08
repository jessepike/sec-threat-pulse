#!/usr/bin/env node
// Applies pending Drizzle migrations from ./drizzle before `next build` on Vercel, so a schema change
// is in the database before the code that reads the new columns starts serving. Idempotent: Drizzle
// records applied migrations in __drizzle_migrations. Does nothing without DATABASE_URL (CI, local
// sample-mode builds) and, on Vercel, outside the production build: a preview build must not change
// the shared database before its pull request is reviewed. Previews and the cron routes still apply
// pending migrations on first use through ensureMigrated in src/lib/db/migrate.ts.
//
// Migrations must stay additive (add columns and tables, never drop or rename in the same release):
// the previous deployment keeps serving until the new build goes live.
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
const force = process.argv.includes("--force");
if (!url) {
  console.log("db-migrate: DATABASE_URL is not set, nothing to do");
  process.exit(0);
}
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production" && !force) {
  console.log(`db-migrate: skipped for VERCEL_ENV=${process.env.VERCEL_ENV} (production only)`);
  process.exit(0);
}
const started = Date.now();
try {
  await migrate(drizzle(neon(url)), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log(`db-migrate: migrations up to date (${Date.now() - started} ms)`);
} catch (e) {
  console.error(`db-migrate: failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
