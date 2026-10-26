import { unstable_cache } from "next/cache";
import { API_HEADERS, API_NOTICE, API_VERSION, apiEvents, parseApiVerdict } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

const cached = unstable_cache((verdict: string, page: number) => apiEvents({ verdict: parseApiVerdict(verdict), page }), ["api-v1-events"], { revalidate: 300, tags: ["stp"] });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const verdict = url.searchParams.get("verdict") ?? "";
  if (verdict && !parseApiVerdict(verdict)) return Response.json({ error: "verdict must be act_now, watch or low" }, { status: 400, headers: API_HEADERS });
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const data = await cached(verdict, page);
  if (!data) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  return Response.json({ apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), ...data }, { headers: API_HEADERS });
}
