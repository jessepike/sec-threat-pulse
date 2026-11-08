import { CURRENT_RULES_VERSION } from "@/lib/ladder/rules";
import type { SourceHealth } from "@/lib/ingest/health";
import { API_VERSION } from "./v1";
import { SITE_URL } from "@/lib/site";

/**
 * The public health report behind /status.json and /api/v1/health.
 *
 * Two clocks matter and they are kept apart, as Security Market Pulse does: `lastCompleteAt` is the
 * last time the events cron finished and the public pages were rebuilt from fresh evidence;
 * `lastAttemptAt` is the last time anything ran, success or not. A site that keeps attempting and
 * never completes is delayed, and this report says so.
 */

export type SiteState = "ok" | "delayed" | "down";

/** The site is delayed when nothing has completed for this long. The events cron runs every 15 minutes. */
export const DELAYED_AFTER_MS = 60 * 60_000;

export interface HealthInput {
  /** Per-source health from the ingest health check. */
  sources: SourceHealth[];
  /** Health of the events cron itself. */
  eventsSync: SourceHealth;
  /** Last run of the events cron, success or not. */
  eventsSyncAttemptAt: string | null;
  /** Newest run start across all sources, success or not. */
  sourcesAttemptAt: string | null;
  /** Database storage check, when available. */
  database: SourceHealth | null;
  counts: { act_now: number; watch: number; low: number; total: number };
  /** Newest dated evidence across visible events. */
  newestEvidenceAt: string | null;
}

export interface HealthReport {
  apiVersion: string;
  generatedAt: string;
  /** ok: fresh. delayed: alive but nothing completed within the hour. down: no data at all. */
  state: SiteState;
  /** One plain sentence a reader or an agent can show. */
  summary: string;
  lastCompleteAt: string | null;
  lastAttemptAt: string | null;
  /** When the next events cron run is due, from the last complete run. */
  nextRunDueAt: string | null;
  rulesVersion: string;
  counts: HealthInput["counts"];
  newestEvidenceAt: string | null;
  sources: {
    total: number;
    ok: number;
    failing: number;
    stale: number;
    unconfigured: number;
    list: { id: string; name: string; state: SourceHealth["state"]; lastSuccessAt: string | null; reason: string }[];
  };
  eventsSync: { state: SourceHealth["state"]; lastSuccessAt: string | null; reason: string };
  database: { state: SourceHealth["state"]; reason: string } | null;
  links: { site: string; api: string; methodology: string; alerts: string };
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function buildHealth(input: HealthInput, now: Date = new Date()): HealthReport {
  const lastCompleteAt = input.eventsSync.lastSuccessAt ?? null;
  const lastAttemptAt = later(input.eventsSyncAttemptAt, input.sourcesAttemptAt);
  const age = lastCompleteAt ? now.getTime() - Date.parse(lastCompleteAt) : Infinity;
  const state: SiteState = !lastCompleteAt && input.counts.total === 0 ? "down" : age > DELAYED_AFTER_MS ? "delayed" : "ok";
  const failing = input.sources.filter((s) => s.state === "failing").length;
  const stale = input.sources.filter((s) => s.state === "stale").length;
  const unhealthy = failing + stale;
  const mins = Number.isFinite(age) ? Math.round(age / 60_000) : null;
  const summary =
    state === "down"
      ? "No data is available. The site has not completed a run."
      : state === "delayed"
        ? `Delayed. The last complete run was ${mins} minutes ago; runs are due every 15 minutes. The site shows the last good data.`
        : unhealthy
          ? `Fresh. The last complete run was ${mins} minutes ago. ${unhealthy} of ${input.sources.length} sources ${unhealthy === 1 ? "needs" : "need"} attention; the rest are current.`
          : `Fresh. The last complete run was ${mins} minutes ago and every source is current.`;
  return {
    apiVersion: API_VERSION,
    generatedAt: now.toISOString(),
    state,
    summary,
    lastCompleteAt,
    lastAttemptAt,
    nextRunDueAt: lastCompleteAt ? new Date(Date.parse(lastCompleteAt) + 15 * 60_000).toISOString() : null,
    rulesVersion: CURRENT_RULES_VERSION,
    counts: input.counts,
    newestEvidenceAt: input.newestEvidenceAt,
    sources: {
      total: input.sources.length,
      ok: input.sources.filter((s) => s.state === "ok").length,
      failing,
      stale,
      unconfigured: input.sources.filter((s) => s.state === "unconfigured").length,
      list: input.sources
        .map((s) => ({ id: s.id, name: s.name, state: s.state, lastSuccessAt: s.lastSuccessAt ?? null, reason: s.reason }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    },
    eventsSync: { state: input.eventsSync.state, lastSuccessAt: lastCompleteAt, reason: input.eventsSync.reason },
    database: input.database ? { state: input.database.state, reason: input.database.reason } : null,
    links: {
      site: SITE_URL,
      api: `${SITE_URL}/api/v1/events`,
      methodology: `${SITE_URL}/methodology`,
      alerts: "https://github.com/jessepike/sec-threat-pulse/issues?q=is%3Aissue+is%3Aopen+label%3Aalert",
    },
  };
}

/** The report when there is no database at all (local preview or a broken deploy). */
export function downReport(now: Date = new Date()): HealthReport {
  return buildHealth(
    {
      sources: [],
      eventsSync: { id: "events-sync", name: "Event builder (events cron)", state: "unconfigured", reason: "", lastSuccessAt: null },
      eventsSyncAttemptAt: null,
      sourcesAttemptAt: null,
      database: null,
      counts: { act_now: 0, watch: 0, low: 0, total: 0 },
      newestEvidenceAt: null,
    },
    now,
  );
}

export const HEALTH_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  // Short cache so a probe sees a fresh answer; stale-while-revalidate keeps it cheap.
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  "Access-Control-Allow-Origin": "*",
  "X-Robots-Tag": "noindex",
};
