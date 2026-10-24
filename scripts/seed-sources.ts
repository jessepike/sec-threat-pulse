// Usage: npx tsx scripts/seed-sources.ts   (needs DATABASE_URL, from the shell or .env.local)
import { getDb } from "../src/lib/db/client";
import type { Db } from "../src/lib/ingest/db";
import { SOURCE_REGISTRY } from "../src/lib/ingest/registry";
import { seedSources } from "../src/lib/ingest/runner";
import { loadLocalEnv } from "./env";

loadLocalEnv();
async function main() {
  const db = getDb() as Db | null;
  if (!db) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const n = await seedSources(db, SOURCE_REGISTRY);
  console.log(`Seeded ${n} sources:`);
  for (const d of SOURCE_REGISTRY) console.log(`  ${d.adapter.id.padEnd(16)} ${d.category.padEnd(11)} ${d.termsStatus}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
