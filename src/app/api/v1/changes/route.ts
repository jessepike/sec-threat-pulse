import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/client";
import type { Db } from "@/lib/ingest/db";
import { API_HEADERS, API_NOTICE, API_VERSION } from "@/lib/api/v1";
import { apiChanges, parseChangesSince } from "@/lib/api/changes";

export const dynamic = "force-dynamic";

const cached = unstable_cache(
  async (sinceIso: string, page: number) => {
    const db = getDb() as Db | null;
    return db ? apiChanges(db, new Date(sinceIso), page) : null;
  },
  ["api-v1-changes"],
  { revalidate: 300, tags: ["stp"] },
);

/** Verdict and ladder changes since a time (default 7 days, at most 90), newest first, 100 a page. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = parseChangesSince(sp.get("since"));
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400, headers: API_HEADERS });
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  // Round to the minute so the cache key is stable across a burst of requests.
  const since = new Date(Math.floor(parsed.since.getTime() / 60_000) * 60_000).toISOString();
  const data = await cached(since, page);
  if (!data) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  return Response.json({ apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), since, ...data }, { headers: API_HEADERS });
}
