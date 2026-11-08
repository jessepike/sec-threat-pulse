import { openApiDocument } from "@/lib/api/openapi";

export const dynamic = "force-static";

export function GET() {
  return Response.json(openApiDocument(), {
    headers: { "Content-Type": "application/vnd.oai.openapi+json; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex" },
  });
}
