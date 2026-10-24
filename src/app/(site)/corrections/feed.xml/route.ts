import { getCorrections } from "@/lib/data";
import { correctionsFeed } from "@/lib/feed";
import { indexingAllowed } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await getCorrections();
  const headers: Record<string, string> = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  };
  if (!indexingAllowed()) headers["X-Robots-Tag"] = "noindex";
  return new Response(correctionsFeed(rows), { headers });
}
