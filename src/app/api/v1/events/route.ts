import { unstable_cache } from "next/cache";
import { API_HEADERS, API_NOTICE, API_VERSION, apiEvents, parseApiFilters, type ApiListFilters } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

const cached = unstable_cache((key: string) => apiEvents(JSON.parse(key) as ApiListFilters), ["api-v1-events"], { revalidate: 1800, tags: ["stp"] });

export async function GET(req: Request) {
  const parsed = parseApiFilters(new URL(req.url).searchParams);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400, headers: API_HEADERS });
  const f = parsed.filters;
  const data = await cached(JSON.stringify({ verdict: f.verdict, page: f.page, product: f.product, cve: f.cve, since: f.since }));
  if (!data) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  return Response.json(
    { apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), filters: { verdict: f.verdict, product: f.product, cve: f.cve, since: f.since }, ...data },
    { headers: API_HEADERS },
  );
}
