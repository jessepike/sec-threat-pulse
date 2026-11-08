import { API_HEADERS, API_NOTICE, API_VERSION, STACK_MAX_PRODUCTS, parseStack } from "@/lib/api/v1";
import { cachedCheckStack } from "@/lib/api/cached";

export const dynamic = "force-dynamic";

/** Vendors or products in, the Act now and Watch events naming each one out. */
export async function GET(req: Request) {
  const products = parseStack(new URL(req.url).searchParams.get("products"));
  if (!products)
    return Response.json(
      { error: `Give products as a comma-separated list of 1 to ${STACK_MAX_PRODUCTS} vendor or product names, 2 to 80 characters each, for example ?products=Fortinet,PAN-OS,Ivanti.` },
      { status: 400, headers: API_HEADERS },
    );
  const data = await cachedCheckStack(products);
  if (!data) return Response.json({ error: "Data is not available right now." }, { status: 503, headers: API_HEADERS });
  return Response.json({ apiVersion: API_VERSION, notice: API_NOTICE, generatedAt: new Date().toISOString(), products, ...data }, { headers: API_HEADERS });
}
