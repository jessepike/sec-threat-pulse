import { API_HEADERS, API_NOTICE, API_VERSION } from "@/lib/api/v1";
import { cachedBrief } from "@/lib/api/cached";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The week's short list: up to five Act now events in rank order and one sentence, as on the home page. */
export async function GET() {
  const data = await cachedBrief();
  if (!data) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  return Response.json(
    { apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), page: `${SITE_URL}/`, feed: `${SITE_URL}/brief/feed.xml`, ...data },
    { headers: API_HEADERS },
  );
}
