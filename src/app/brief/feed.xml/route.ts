import { cachedBrief } from "@/lib/api/cached";
import { briefFeed } from "@/lib/feed";
import { getHomeData, getMode } from "@/lib/data";
import { weekStartIso } from "@/lib/data/format";
import { indexingAllowed } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The weekly short list as RSS: one item per week. */
export async function GET() {
  let brief;
  if (getMode() === "sample") {
    const h = await getHomeData();
    brief = { week: weekStartIso(new Date(`${h.weekOf} 12:00 UTC`)), weekOf: h.weekOf, weekLine: h.weekLine, top: h.top.map(({ rank, row }) => ({ rank, id: row.id, title: row.title, doThis: row.category?.doThis ?? row.question ?? row.exposure, tier: row.tier ?? null })) };
  } else {
    brief = await cachedBrief();
    if (!brief) return new Response("Data is not available right now.", { status: 503 });
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  };
  if (!indexingAllowed()) headers["X-Robots-Tag"] = "noindex";
  return new Response(briefFeed(brief), { headers });
}
