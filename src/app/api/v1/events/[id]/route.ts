import { unstable_cache } from "next/cache";
import { API_HEADERS, API_NOTICE, API_VERSION, apiEvent } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

const cached = unstable_cache((id: string) => apiEvent(id), ["api-v1-event"], { revalidate: 1800, tags: ["stp"] });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{3,120}$/.test(id)) return Response.json({ error: "Unknown event id." }, { status: 404, headers: API_HEADERS });
  const data = await cached(id);
  if (data === null) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  if (data === false) return Response.json({ error: "Unknown event id." }, { status: 404, headers: API_HEADERS });
  return Response.json({ apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), event: data }, { headers: API_HEADERS });
}
