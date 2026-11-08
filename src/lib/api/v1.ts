import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { SOURCE_REGISTRY } from "@/lib/ingest/registry";
import type { ExploitMaturity, Verdict } from "@/lib/ladder/types";
import type { ActTier } from "@/lib/ladder/rules";
import { homeRecs, kevFix, loadRecords, recMatchesProduct, type Rec } from "@/lib/data/db";
import { weekOfLabel, weekStartIso } from "@/lib/data/format";
import { topFive, weekLine } from "@/lib/data/top";
import { CURRENT_RULES_VERSION } from "@/lib/ladder/rules";
import { SITE_URL } from "@/lib/site";
import { categorize, type Category } from "@/lib/ladder/category";
import { untrackedRungs } from "@/lib/ladder/coverage";
import { EMPTY_LADDER, type Ladder } from "@/lib/ladder/types";
import { computeClock, sourceCounts, type Clock } from "@/lib/ladder/clock";
import { resolveAffectedProducts, type AffectedProduct } from "@/lib/products";

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
  /** Tier inside Act now ("today" or "now") from the rules version, null below Act now or before rules v3. */
  tier: ActTier | null;
  /** Ranking score inside the verdict, higher first; null before rules v3. */
  rankScore: number | null;
  /** One line per ranking factor; null before rules v3. */
  rankWhy: string[] | null;
  rulesVersion: string;
  ladder: Record<string, string>;
  /** Rungs with no evidence that no source we use can fill yet. Read "none" there as unknown, not as nothing. */
  untrackedRungs: string[];
  cves: string[];
  vendor: string | null;
  product: string | null;
  /** Canonical affected products: direct ones first, then products that ship the component (kind "embedded", with a reference). */
  affectedProducts: AffectedProduct[];
  /** Plain category, why it matters and the first step, from a fixed table. */
  category: Category;
  summary: string | null;
  /** Highest CVSS base score among the event's CVEs, when known. */
  cvss: number | null;
  /** Highest EPSS probability among the event's CVEs, when known. */
  epss: number | null;
  exploitMaturity: ExploitMaturity;
  kevListed: boolean;
  /** Earliest CISA KEV addition date (YYYY-MM-DD), when listed. */
  kevDateAdded: string | null;
  /** CISA's deadline for US federal agencies (YYYY-MM-DD), when listed. */
  kevDueDate: string | null;
  firstSeenAt: string;
  updatedAt: string;
  newestEvidenceAt: string;
}

/** Facts per event that the summary needs beyond the events row. */
interface SummaryFacts {
  cves: string[];
  cvss: number | null;
  epss: number | null;
  kevDateAdded: string | null;
  kevDueDate: string | null;
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
  /** Dated points practitioners rank by, each with the observation that set it. Missing dates are absent. */
  clock: Clock;
  /** Distinct sources behind each rung. */
  ladderSources: Record<string, number>;
  evidence: ApiEvidence[];
  evidenceWithheld: number;
}

const asLadder = (l: Record<string, string>): Ladder => ({ ...EMPTY_LADDER, ...(l as Partial<Ladder>) });

function toSummary(r: Rec, f: SummaryFacts): ApiEventSummary {
  const e = r.e;
  return {
    id: e.id,
    url: `${SITE_URL}/events/${e.id}`,
    title: e.titleOverride ?? e.title,
    verdict: r.verdict,
    verdictReason: e.overrideReason ?? e.verdictReason ?? null,
    tier: r.verdict === "act_now" && (e.tier === "today" || e.tier === "now") ? e.tier : null,
    rankScore: e.rankScore ?? null,
    rankWhy: e.rankWhy ?? null,
    rulesVersion: e.rulesVersion,
    ladder: e.ladder,
    untrackedRungs: untrackedRungs(e.kind, asLadder(e.ladder)),
    cves: f.cves,
    vendor: e.vendor,
    product: e.product,
    affectedProducts: e.affectedProducts?.length ? e.affectedProducts : resolveAffectedProducts([{ vendor: e.vendor, product: e.product, evidence: "kev" }]),
    category: categorize(e.vendor, e.product),
    summary: e.summary,
    cvss: f.cvss,
    epss: f.epss,
    exploitMaturity: (e.exploitMaturity as ExploitMaturity) ?? "none",
    kevListed: f.kevDateAdded !== null,
    kevDateAdded: f.kevDateAdded,
    kevDueDate: f.kevDueDate,
    firstSeenAt: e.firstSeenAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    newestEvidenceAt: new Date(r.evidenceAt).toISOString(),
  };
}

type Db = NonNullable<ReturnType<typeof getDb>>;

/** CVEs, scores, KEV dates and deadlines for a set of events, in three queries. */
async function loadFacts(db: Db, ids: string[]): Promise<Map<string, SummaryFacts>> {
  const out = new Map<string, SummaryFacts>();
  for (const id of ids) out.set(id, { cves: [], cvss: null, epss: null, kevDateAdded: null, kevDueDate: null });
  if (!ids.length) return out;
  const rows = await db.select().from(schema.eventCves).where(inArray(schema.eventCves.eventId, ids));
  for (const r of rows) out.get(r.eventId)!.cves.push(r.cveId);
  const allCves = [...new Set(rows.map((r) => r.cveId))];
  const vulns = allCves.length
    ? await db
        .select({ cveId: schema.vulnerabilities.cveId, cvss: schema.vulnerabilities.cvssScore, epss: schema.vulnerabilities.epss, kev: schema.vulnerabilities.kevCisaDateAdded })
        .from(schema.vulnerabilities)
        .where(inArray(schema.vulnerabilities.cveId, allCves))
    : [];
  const byCve = new Map(vulns.map((v) => [v.cveId, v]));
  const kevObs = await db
    .select({ eventId: schema.observations.eventId, metadata: schema.observations.metadata })
    .from(schema.observations)
    .where(and(inArray(schema.observations.eventId, ids), eq(schema.observations.sourceId, "cisa-kev")));
  const dueBy = new Map<string, string>();
  for (const o of kevObs) {
    const due = (o.metadata as { dueDate?: unknown } | null)?.dueDate;
    if (o.eventId && typeof due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due) && (!dueBy.has(o.eventId) || due < dueBy.get(o.eventId)!)) dueBy.set(o.eventId, due);
  }
  for (const [id, f] of out) {
    f.cves.sort();
    const vs = f.cves.map((c) => byCve.get(c)).filter((v): v is NonNullable<typeof v> => !!v);
    const scores = vs.map((v) => v.cvss).filter((n): n is number => typeof n === "number");
    const epss = vs.map((v) => v.epss).filter((n): n is number => typeof n === "number");
    const kev = vs.map((v) => v.kev?.slice(0, 10)).filter((d): d is string => !!d).sort();
    f.cvss = scores.length ? Math.max(...scores) : null;
    f.epss = epss.length ? Math.max(...epss) : null;
    f.kevDateAdded = kev[0] ?? null;
    f.kevDueDate = dueBy.get(id) ?? null;
  }
  return out;
}

export function parseApiVerdict(v: string | null): Verdict | null {
  return v === "act_now" || v === "watch" || v === "low" ? v : null;
}

export interface ApiListFilters {
  verdict: Verdict | null;
  page: number;
  /** Vendor, product, label or slug; matched against affectedProducts. */
  product?: string | null;
  /** A CVE id; events that include it. */
  cve?: string | null;
  /** ISO timestamp; only events updated at or after it (a changes feed for agents). */
  since?: string | null;
}

export const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;

/** Parse list filters from a query string. Returns an error message for a bad value. */
export function parseApiFilters(sp: URLSearchParams): { filters: ApiListFilters } | { error: string } {
  const verdictRaw = sp.get("verdict") ?? "";
  if (verdictRaw && !parseApiVerdict(verdictRaw)) return { error: "verdict must be act_now, watch or low" };
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const product = sp.get("product")?.trim().slice(0, 80) || null;
  const cve = sp.get("cve")?.trim().toUpperCase() || null;
  if (cve && !CVE_RE.test(cve)) return { error: "cve must look like CVE-2026-12345" };
  const since = sp.get("since")?.trim() || null;
  if (since && Number.isNaN(Date.parse(since))) return { error: "since must be an ISO 8601 timestamp" };
  return { filters: { verdict: parseApiVerdict(verdictRaw), page, product, cve, since } };
}

/** Events in display order (verdict, then newest evidence), narrowed by the filters. */
export async function apiEvents(opts: ApiListFilters): Promise<{ total: number; page: number; pages: number; events: ApiEventSummary[] } | null> {
  const db = getDb();
  if (!db) return null;
  let recs = (await loadRecords(db)).filter((r) => !opts.verdict || r.verdict === opts.verdict);
  if (opts.product) recs = recs.filter((r) => recMatchesProduct(r.e, opts.product!));
  if (opts.since) {
    const t = Date.parse(opts.since);
    // Changed since: the event row changed, newer evidence was published, or older evidence was attached.
    recs = recs.filter((r) => r.e.updatedAt.getTime() >= t || r.evidenceAt >= t || (r.seenAt ?? 0) >= t);
  }
  if (opts.cve) {
    const hits = new Set((await db.select({ eventId: schema.eventCves.eventId }).from(schema.eventCves).where(eq(schema.eventCves.cveId, opts.cve))).map((x) => x.eventId));
    recs = recs.filter((r) => hits.has(r.e.id));
  }
  const pages = Math.max(1, Math.ceil(recs.length / API_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);
  const slice = recs.slice((page - 1) * API_PAGE_SIZE, page * API_PAGE_SIZE);
  const facts = await loadFacts(db, slice.map((r) => r.e.id));
  return { total: recs.length, page, pages, events: slice.map((r) => toSummary(r, facts.get(r.e.id)!)) };
}

/** Every visible event as a summary, in display order, for the bulk export. */
export async function apiAllEvents(): Promise<ApiEventSummary[] | null> {
  const db = getDb();
  if (!db) return null;
  const recs = await loadRecords(db);
  const facts = await loadFacts(db, recs.map((r) => r.e.id));
  return recs.map((r) => toSummary(r, facts.get(r.e.id)!));
}

export interface ApiBriefItem extends ApiEventSummary {
  rank: number;
  /** The first step, from the fixed category table. */
  doThis: string;
}

export interface ApiBrief {
  /** Monday of the week, Pacific time (YYYY-MM-DD). The brief's permanent id. */
  week: string;
  weekOf: string;
  /** One sentence for the week from fixed templates. */
  weekLine: string;
  rulesVersion: string;
  /** Act now events with an attack, exploitation or damage report in the last 30 days. The list ranks these. */
  actNowRecent: number;
  /** Up to five, in rank order (verdict, tier, score, newest evidence). Never padded with Watch. */
  top: ApiBriefItem[];
}

/** The week's short list: the same top five and sentence the home page shows. */
export async function apiBrief(now: Date = new Date()): Promise<ApiBrief | null> {
  const db = getDb();
  if (!db) return null;
  const all = await loadRecords(db);
  const shown = homeRecs(all);
  const ranked = shown.map((r) => ({ r, verdict: r.verdict, tier: r.verdict === "act_now" && (r.e.tier === "today" || r.e.tier === "now") ? (r.e.tier as ActTier) : null }));
  const top = topFive(ranked);
  const facts = await loadFacts(db, top.map((t) => t.row.r.e.id));
  const items = top.map(({ rank, row }) => {
    const s = toSummary(row.r, facts.get(row.r.e.id)!);
    return { rank, ...s, doThis: s.category.doThis };
  });
  return {
    week: weekStartIso(now),
    weekOf: weekOfLabel(now),
    weekLine: weekLine(ranked, top, all.filter((r) => r.verdict === "act_now").length),
    rulesVersion: CURRENT_RULES_VERSION,
    actNowRecent: ranked.filter((x) => x.verdict === "act_now").length,
    top: items,
  };
}

/** At most this many products per stack check, and matches returned per product. */
export const STACK_MAX_PRODUCTS = 25;
export const STACK_MAX_MATCHES = 10;

export interface ApiStackHit {
  query: string;
  /** Matching events at Act now or Watch, any age. */
  matched: number;
  actNow: number;
  /** Up to 10, in display order. */
  events: ApiEventSummary[];
}

/** Splits "Fortinet, PAN-OS,ivanti" into clean product queries. Null when a query has characters we do not accept. */
export function parseStack(raw: string | null): string[] | null {
  const items = (raw ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  if (!items.length || items.length > STACK_MAX_PRODUCTS) return null;
  if (items.some((x) => x.length < 2 || x.length > 80 || !/^[\w .&/+-]+$/.test(x))) return null;
  return [...new Set(items.map((x) => x.toLowerCase()))];
}

/** For each vendor or product in a stack, the Act now and Watch events that name it. */
export async function apiCheckStack(products: string[]): Promise<{ results: ApiStackHit[]; actNowTotal: number } | null> {
  const db = getDb();
  if (!db) return null;
  const recs = (await loadRecords(db)).filter((r) => r.verdict === "act_now" || r.verdict === "watch");
  const results = products.map((q) => {
    const hits = recs.filter((r) => recMatchesProduct(r.e, q));
    return { q, hits };
  });
  const ids = [...new Set(results.flatMap((x) => x.hits.slice(0, STACK_MAX_MATCHES).map((r) => r.e.id)))];
  const facts = await loadFacts(db, ids);
  const actNowIds = new Set(results.flatMap((x) => x.hits.filter((r) => r.verdict === "act_now").map((r) => r.e.id)));
  return {
    actNowTotal: actNowIds.size,
    results: results.map(({ q, hits }) => ({
      query: q,
      matched: hits.length,
      actNow: hits.filter((r) => r.verdict === "act_now").length,
      events: hits.slice(0, STACK_MAX_MATCHES).map((r) => toSummary(r, facts.get(r.e.id)!)),
    })),
  };
}

/** One event with its evidence, minus sources we may not re-serve. */
export async function apiEvent(id: string): Promise<ApiEventDetail | null | false> {
  const db = getDb();
  if (!db) return null;
  const rec = (await loadRecords(db)).find((r) => r.e.id === id);
  if (!rec) return false;
  const facts = (await loadFacts(db, [id])).get(id)!;
  const vulns = facts.cves.length
    ? await db.select({ cveId: schema.vulnerabilities.cveId, publishedAt: schema.vulnerabilities.publishedAt, kevCisaDateAdded: schema.vulnerabilities.kevCisaDateAdded }).from(schema.vulnerabilities).where(inArray(schema.vulnerabilities.cveId, facts.cves))
    : [];
  const obs = await db
    .select({ o: schema.observations, name: schema.sources.name, attribution: schema.sources.attribution })
    .from(schema.observations)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.observations.sourceId))
    .where(and(eq(schema.observations.eventId, id)))
    .orderBy(desc(schema.observations.publishedAt));
  const allowed = obs.filter((x) => !API_EXCLUDED_SOURCES.has(x.o.sourceId));
  // The clock and the counts use every source, including withheld ones: they are our own facts about the evidence, with no re-served content.
  const clock = computeClock(vulns, obs.map((x) => ({ ...x.o, sourceName: x.name })));
  for (const k of ["exploitCode", "firstReport"] as const) {
    const point = clock[k];
    const src = obs.find((x) => x.o.url === point?.url);
    if (point && src && API_EXCLUDED_SOURCES.has(src.o.sourceId)) clock[k] = { date: point.date, label: "a source withheld from the API" };
  }
  return {
    ...toSummary(rec, facts),
    fix: kevFix(obs.map((x) => x.o)) ?? null,
    clock,
    ladderSources: sourceCounts(obs.map((x) => x.o)),
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
