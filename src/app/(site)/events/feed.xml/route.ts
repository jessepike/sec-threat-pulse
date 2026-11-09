import { unstable_cache } from "next/cache";
import { apiEvents } from "@/lib/api/v1";
import { actNowFeed } from "@/lib/feed";
import { indexingAllowed } from "@/lib/site";

export const dynamic = "force-dynamic";

const cached = unstable_cache(() => apiEvents({ verdict: "act_now", page: 1 }), ["feed-act-now"], { revalidate: 1800, tags: ["stp"] });

export async function GET() {
  const data = await cached();
  const events = (data?.events ?? []).slice(0, 30).map((e) => ({ id: e.id, title: e.title, summary: e.summary, verdictReason: e.verdictReason, updatedAt: e.newestEvidenceAt }));
  const headers: Record<string, string> = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  };
  if (!indexingAllowed()) headers["X-Robots-Tag"] = "noindex";
  return new Response(actNowFeed(events), { headers });
}
