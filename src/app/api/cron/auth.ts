import { timingSafeEqual } from "node:crypto";

/**
 * Checks `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this header when CRON_SECRET is
 * set in the project. Returns an error Response, or null when the request may proceed.
 */
export function checkCronAuth(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
