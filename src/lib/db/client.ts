import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Returns the database, or null when DATABASE_URL is not set (local preview with sample data). */
export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = drizzle(neon(url), { schema });
  return cached;
}

export { schema };
