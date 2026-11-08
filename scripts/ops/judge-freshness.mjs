// Decides, from /status.json, whether the site is fresh. Pure: no network, so it is unit tested.
// Used by scripts/ops/freshness-probe.mjs, which runs from GitHub Actions, away from Vercel.

/** Alert when the last complete run is older than this. The events cron runs every 15 minutes. */
export const STALE_AFTER_MS = 60 * 60_000;

/**
 * @param {{ ok: boolean, status: number, body: unknown, error?: string }} probe  the HTTP result
 * @param {Date} now
 * @returns {{ state: "ok" | "stale" | "down", reason: string, lastCompleteAt: string | null }}
 */
export function judgeFreshness(probe, now = new Date()) {
  if (!probe.ok || probe.body === null || typeof probe.body !== "object") {
    const why = probe.error ? probe.error : `HTTP ${probe.status}`;
    return { state: "down", reason: `/status.json did not answer with a report (${why}).`, lastCompleteAt: null };
  }
  const body = /** @type {Record<string, unknown>} */ (probe.body);
  const lastCompleteAt = typeof body.lastCompleteAt === "string" ? body.lastCompleteAt : null;
  if (body.state === "down" || !lastCompleteAt) {
    return { state: "down", reason: typeof body.summary === "string" ? body.summary : "The site reports no completed run.", lastCompleteAt };
  }
  const age = now.getTime() - Date.parse(lastCompleteAt);
  if (!Number.isFinite(age) || age > STALE_AFTER_MS) {
    const mins = Number.isFinite(age) ? Math.round(age / 60_000) : null;
    const attempt = typeof body.lastAttemptAt === "string" ? ` The last attempt was ${body.lastAttemptAt}.` : "";
    return { state: "stale", reason: `The last complete run was ${mins === null ? "at an unreadable time" : `${mins} minutes ago`} (${lastCompleteAt}); runs are due every 15 minutes.${attempt}`, lastCompleteAt };
  }
  return { state: "ok", reason: "", lastCompleteAt };
}
