import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/client";
import type { Db } from "@/lib/ingest/db";
import { apiChanges, changesFeed, CHANGES_DEFAULT_DAYS } from "@/lib/api/changes";
import { indexingAllowed } from "@/lib/site";

export const dynamic = "force-dynamic";

const cached = unstable_cache(
  async (sinceIso: string) => {
    const db = getDb() as Db | null;
    return db ? apiChanges(db, new Date(sinceIso), 1) : null;
  },
  ["feed-changes"],
  { revalidate: 1800, tags: ["stp"] },
);

/** RSS of verdict and ladder changes in the last 7 days, newest first, 50 items. */
export async function GET() {
  const since = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - CHANGES_DEFAULT_DAYS * 86_400_000).toISOString();
  const data = await cached(since);
  const headers: Record<string, string> = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  };
  if (!indexingAllowed()) headers["X-Robots-Tag"] = "noindex";
  return new Response(changesFeed((data?.changes ?? []).slice(0, 50)), { headers });
}
