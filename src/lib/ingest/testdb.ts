import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { Db } from "./db";

let shared: Promise<Db> | undefined;

/**
 * In-memory Postgres with the real migrations applied, shared within a test file.
 * Every call returns the same database with all tables emptied. For tests only.
 */
export async function createTestDb(): Promise<Db> {
  shared ??= (async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
    return db as unknown as Db;
  })();
  const db = await shared;
  await db.execute(
    sql`truncate table audit_log, corrections, verdict_history, event_cves, events, observations, source_runs, sources, vulnerabilities, settings restart identity cascade`,
  );
  return db;
}
