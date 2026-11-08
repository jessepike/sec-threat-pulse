import { HEALTH_HEADERS } from "@/lib/api/health";
import { loadHealth } from "@/lib/api/health-db";

export const dynamic = "force-dynamic";

/**
 * Public health report, no key. 200 when the site is fresh or delayed (the last good data is still
 * served), 503 when there is no data at all. The outside probe in .github/workflows/freshness.yml
 * reads this and opens an alert issue when the state is not ok.
 */
export async function GET() {
  try {
    const report = await loadHealth();
    return Response.json(report, { status: report.state === "down" ? 503 : 200, headers: HEALTH_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ state: "down", summary: `The health check failed: ${message.slice(0, 200)}`, generatedAt: new Date().toISOString() }, { status: 503, headers: HEALTH_HEADERS });
  }
}
