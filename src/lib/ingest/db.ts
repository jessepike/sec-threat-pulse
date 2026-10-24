import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "@/lib/db/schema";

/** Any Drizzle Postgres database using our schema (Neon HTTP in production, PGlite in tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
