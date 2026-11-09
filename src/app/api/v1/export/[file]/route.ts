import { unstable_cache } from "next/cache";
import { API_HEADERS, API_NOTICE, API_VERSION, apiAllEvents } from "@/lib/api/v1";
import { EXPORT_LICENSE, LICENSE_LINK_HEADER, parseExportName, toCsv, utcDate } from "@/lib/api/export";
import { CURRENT_RULES_VERSION } from "@/lib/ladder/rules";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cached = unstable_cache(() => apiAllEvents(), ["api-v1-export"], { revalidate: 1800, tags: ["stp"] });
const SNAPSHOT_URL = "https://github.com/jessepike/sec-threat-pulse/tree/data";

/**
 * Dated bulk export: /api/v1/export/events-YYYY-MM-DD.csv or .json for today (UTC). Earlier days
 * are served from the nightly snapshot on the data branch, whose git history keeps every day.
 * events-latest.* redirects to today's file so a caller can bookmark one URL and still get a dated file.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = parseExportName(file);
  if (!name) return Response.json({ error: "Expected events-YYYY-MM-DD.csv, events-YYYY-MM-DD.json or events-latest.csv|json" }, { status: 404, headers: API_HEADERS });
  const today = utcDate();
  if (name.date === "latest") {
    // Response.redirect() carries no CORS header, which would fail a browser client on another origin.
    return new Response(null, { status: 302, headers: { ...API_HEADERS, "Cache-Control": "public, max-age=300", Location: `${SITE_URL}/api/v1/export/events-${today}.${name.format}` } });
  }
  if (name.date !== today) {
    return Response.json(
      { error: `Only today's export (${today}) is generated here. Earlier days: the nightly snapshot on the data branch, ${SNAPSHOT_URL} (git history has every day).`, today, snapshot: SNAPSHOT_URL },
      { status: 404, headers: API_HEADERS },
    );
  }
  const events = await cached();
  if (!events) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  const common = { "Cache-Control": API_HEADERS["Cache-Control"], "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex", Link: LICENSE_LINK_HEADER, "Content-Disposition": `attachment; filename="${file}"` };
  if (name.format === "csv") {
    return new Response(toCsv(events), { headers: { ...common, "Content-Type": "text/csv; charset=utf-8" } });
  }
  return Response.json(
    { apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), date: today, rulesVersion: CURRENT_RULES_VERSION, license: EXPORT_LICENSE, total: events.length, events },
    { headers: { ...common, "Content-Type": "application/json; charset=utf-8" } },
  );
}
