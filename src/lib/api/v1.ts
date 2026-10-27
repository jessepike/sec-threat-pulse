import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { SOURCE_REGISTRY } from "@/lib/ingest/registry";
import type { Verdict } from "@/lib/ladder/types";
import { kevFix, loadRecords, type Rec } from "@/lib/data/db";
import { SITE_URL } from "@/lib/site";
import { categorize, type Category } from "@/lib/ladder/category";

export const API_VERSION = "1";
export const API_PAGE_SIZE = 50;

/**
 * Sources whose data we show on our own pages but do not re-serve through the API until their
 * terms are confirmed: VulnCheck (re-serving to agents not yet approved) and any source whose terms
 * are unclear, need approval or are blocked. Verdicts and ladders are our own facts and stay in.
 */
export const API_EXCLUDED_SOURCES = new Set<string>([
  "vulncheck-kev",
  ...SOURCE_REGISTRY.filter((d) => d.termsStatus === "unclear" || d.termsStatus === "approval_needed" || d.termsStatus === "blocked").map((d) => d.adapter.id),
]);

export interface ApiEventSummary {
  id: string;
  url: string;
  title: string;
  verdict: Verdict;
  verdictReason: string | null;
  rulesVersion: string;
  ladder: Record<string, string>;
  cves: string[];
  vendor: string | null;
  product: string | null;
  /** Plain category, why it matters and the first step, from a fixed table. */
  category: Category;
  summary: string | null;
  firstSeenAt: string;
  updatedAt: string;
  newestEvidenceAt: string;
}

export interface ApiEvidence {
  rung: string;
  strength: string;
  title: string;
  url: string;
  publishedAt: string | null;
  source: { id: string; name: string | null; attribution: string | null };
}

export interface ApiEventDetail extends ApiEventSummary {
  fix: string | null;
  evidence: ApiEvidence[];
  evidenceWithheld: number;
}

function toSummary(r: Rec, cves: string[]): ApiEventSummary {
  const e = r.e;
  return {
    id: e.id,
    url: `${SITE_URL}/events/${e.id}`,
    title: e.titleOverride ?? e.title,
    verdict: r.verdict,
    verdictReason: e.overrideReason ?? e.verdictReason ?? null,
    rulesVersion: e.rulesVersion,
    ladder: e.ladder,
    cves,
    vendor: e.vendor,
    product: e.product,
    category: categorize(e.vendor, e.product),
    summary: e.summary,
    firstSeenAt: e.firstSeenAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    newestEvidenceAt: new Date(r.evidenceAt).toISOString(),
  };
}

export function parseApiVerdict(v: string | null): Verdict | null {
  return v === "act_now" || v === "watch" || v === "low" ? v : null;
}

/** Events in display order (verdict, then newest evidence). */
export async function apiEvents(opts: { verdict: Verdict | null; page: number }): Promise<{ total: number; page: number; pages: number; events: ApiEventSummary[] } | null> {
  const db = getDb();
  if (!db) return null;
  const recs = (await loadRecords(db)).filter((r) => !opts.verdict || r.verdict === opts.verdict);
  const pages = Math.max(1, Math.ceil(recs.length / API_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);
  const slice = recs.slice((page - 1) * API_PAGE_SIZE, page * API_PAGE_SIZE);
  const ids = slice.map((r) => r.e.id);
  const rows = ids.length ? await db.select().from(schema.eventCves).where(inArray(schema.eventCves.eventId, ids)) : [];
  const cves = new Map<string, string[]>();
  for (const r of rows) cves.set(r.eventId, [...(cves.get(r.eventId) ?? []), r.cveId].sort());
  return { total: recs.length, page, pages, events: slice.map((r) => toSummary(r, cves.get(r.e.id) ?? [])) };
}

/** One event with its evidence, minus sources we may not re-serve. */
export async function apiEvent(id: string): Promise<ApiEventDetail | null | false> {
  const db = getDb();
  if (!db) return null;
  const rec = (await loadRecords(db)).find((r) => r.e.id === id);
  if (!rec) return false;
  const cves = (await db.select().from(schema.eventCves).where(eq(schema.eventCves.eventId, id))).map((r) => r.cveId).sort();
  const obs = await db
    .select({ o: schema.observations, name: schema.sources.name, attribution: schema.sources.attribution })
    .from(schema.observations)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.observations.sourceId))
    .where(and(eq(schema.observations.eventId, id)))
    .orderBy(desc(schema.observations.publishedAt));
  const allowed = obs.filter((x) => !API_EXCLUDED_SOURCES.has(x.o.sourceId));
  return {
    ...toSummary(rec, cves),
    fix: kevFix(obs.map((x) => x.o)) ?? null,
    evidence: allowed.map((x) => ({
      rung: x.o.kind,
      strength: x.o.strength,
      title: x.o.title,
      url: x.o.url,
      publishedAt: x.o.publishedAt ? x.o.publishedAt.toISOString() : null,
      source: { id: x.o.sourceId, name: x.name, attribution: x.attribution },
    })),
    evidenceWithheld: obs.length - allowed.length,
  };
}

export const API_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  "Access-Control-Allow-Origin": "*",
  "X-Robots-Tag": "noindex",
};

export const API_NOTICE =
  "Security Threat Pulse API v1. Free, no key. Facts with sources; verdicts follow the published rules at " +
  `${SITE_URL}/methodology. Not advice. Some source data is withheld here until its terms allow re-serving.`;
