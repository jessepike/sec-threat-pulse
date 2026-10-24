import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { getAdmin } from "@/lib/admin/session";
import { runSourceNow } from "@/lib/admin/ingest-trigger";

// POST /api/admin/run-source  { "sourceId": "cisa-kev" }
export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // CSRF: JSON bodies cannot be sent cross-site without a preflight, and the Origin must match.
  const origin = req.headers.get("origin");
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "expected application/json" }, { status: 415 });
  }
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { sourceId?: unknown } | null;
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const result = await runSourceNow(db, admin.login, req.nextUrl.origin, sourceId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
