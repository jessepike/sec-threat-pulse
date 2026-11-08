import { API_HEADERS, API_NOTICE, API_VERSION } from "@/lib/api/v1";
import { ACT_NOW_HORIZON_DAYS, WATCH_HORIZON_DAYS } from "@/lib/track-record";
import { cachedTrackRecord } from "@/lib/track-record/cached";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** How the published verdicts held up: the live record since history began, and the backtest per rules version. */
export async function GET() {
  const data = await cachedTrackRecord();
  if (!data) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  return Response.json(
    {
      apiVersion: API_VERSION,
      notice: API_NOTICE,
      generatedAt: new Date().toISOString(),
      page: `${SITE_URL}/track-record`,
      method: {
        unit: "CVE. A call is the first time the rules put any event naming the CVE at Act now (or Watch or higher). Admin overrides are not scored.",
        truth: "Listing in CISA KEV or VulnCheck KEV, the earliest of the two.",
        actNowHorizonDays: ACT_NOW_HORIZON_DAYS,
        watchHorizonDays: WATCH_HORIZON_DAYS,
        scored: "Only calls made before the listing day. right: listed within the horizon. wrong: the horizon passed with no listing. pending: not settled yet.",
        interval: "95% Wilson interval on right / (right + wrong).",
      },
      ...data,
    },
    { headers: API_HEADERS },
  );
}
