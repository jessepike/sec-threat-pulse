import { computeExploitMaturity, computeLadder, reportedExploitationSources, type LadderObservation } from "./compute";
import { plainTitle } from "./plain-title";
import { CURRENT_RULES_VERSION, evaluateVerdict } from "./rules";
import type { ExploitMaturity, Ladder, Verdict } from "./types";

/** Vulnerability facts the grouper needs. Dates are YYYY-MM-DD. */
export interface EventVuln {
  cveId: string;
  title?: string | null;
  description?: string | null;
  vendor?: string | null;
  product?: string | null;
  kevCisaDateAdded?: string | null;
  kevVulncheckDateAdded?: string | null;
  kevCisaRansomware?: boolean | null;
  epss?: number | null;
  exploitMaturity?: string | null;
  cvssScore?: number | null;
  /** CVE record publish time (Date or ISO string). */
  publishedAt?: Date | string | null;
  cwe?: string[] | null;
}

export interface EventObservation extends LadderObservation {
  id: number;
  cveIds: string[];
}

export interface ComputedEvent {
  id: string;
  title: string;
  summary?: string;
  vendor?: string;
  product?: string;
  cveIds: string[];
  /** ISO timestamp of the earliest KEV addition in the event. */
  firstSeenAt: string;
  ladder: Ladder;
  exploitMaturity: ExploitMaturity;
  verdict: Verdict;
  verdictReason: string;
  rulesVersion: string;
  observationIds: number[];
}

export const GROUP_WINDOW_DAYS = 3;
export const DEFAULT_LOOKBACK_DAYS = 60;
const DAY = 86400000;

/** Earliest KEV addition date across CISA and VulnCheck. */
export function kevDate(v: EventVuln): string | undefined {
  const dates = [v.kevCisaDateAdded, v.kevVulncheckDateAdded].filter((d): d is string => !!d).map((d) => d.slice(0, 10));
  return dates.sort()[0];
}

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function slug(s: string, max = 40): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

const dayNumber = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);

interface Cluster {
  vendor?: string;
  product?: string;
  vulns: EventVuln[];
  firstDate: string;
  lastDate: string;
}

/**
 * Phase 1 grouping: CVEs for the same vendor and product added to KEV within 3 days of each other
 * (chained: each CVE joins when it is within 3 days of the previous one) share one event.
 */
export function clusterKev(vulns: EventVuln[], windowDays = GROUP_WINDOW_DAYS): Cluster[] {
  const groups = new Map<string, EventVuln[]>();
  for (const v of vulns) {
    if (!kevDate(v)) continue;
    const key = `${norm(v.vendor)}|${norm(v.product)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(v);
  }
  const clusters: Cluster[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => kevDate(a)!.localeCompare(kevDate(b)!) || a.cveId.localeCompare(b.cveId));
    let cur: Cluster | undefined;
    for (const v of list) {
      const d = kevDate(v)!;
      if (cur && dayNumber(d) - dayNumber(cur.lastDate) <= windowDays) {
        cur.vulns.push(v);
        cur.lastDate = d;
      } else {
        cur = { vendor: v.vendor ?? undefined, product: v.product ?? undefined, vulns: [v], firstDate: d, lastDate: d };
        clusters.push(cur);
      }
    }
  }
  return clusters.sort((a, b) => a.firstDate.localeCompare(b.firstDate) || a.vulns[0].cveId.localeCompare(b.vulns[0].cveId));
}

function eventTitle(c: Cluster): string {
  const plain = plainTitle({
    vendor: c.vendor,
    product: c.product,
    texts: c.vulns.flatMap((v) => [v.title, v.description]),
    cwe: c.vulns.flatMap((v) => v.cwe ?? []),
    count: c.vulns.length,
  });
  if (plain) return plain;
  if (c.vulns.length === 1) {
    const v = c.vulns[0];
    return v.title?.trim() || [c.vendor, c.product, v.cveId].filter(Boolean).join(" ");
  }
  const name = [c.vendor, c.product].filter((x, i, a) => x && (i === 0 || !x.toLowerCase().includes(a[0]!.toLowerCase()))).join(" ");
  return `${name || "Multiple products"}: ${c.vulns.length} vulnerabilities exploited`;
}

export interface Assessment {
  ladder: Ladder;
  exploitMaturity: ExploitMaturity;
  verdict: Verdict;
  verdictReason: string;
  observationIds: number[];
}

/** Ladder, maturity and verdict for one group of CVEs and the observations that mention them. */
function assessGroup(vulns: EventVuln[], obs: EventObservation[], vendor: string | undefined, product: string | undefined, now: Date, rulesVersion: string): Assessment {
  const ladder = computeLadder(obs);
  const exploitMaturity = computeExploitMaturity(obs, vulns.map((v) => v.exploitMaturity));
  const epss = Math.max(0, ...vulns.map((v) => v.epss ?? 0));
  const cvss = Math.max(0, ...vulns.map((v) => v.cvssScore ?? 0));
  const ages = vulns.map((v) => (v.publishedAt ? Math.floor((now.getTime() - new Date(v.publishedAt).getTime()) / DAY) : undefined)).filter((n): n is number => n !== undefined && Number.isFinite(n));
  const pocRepoCount = Math.max(0, ...obs.map((o) => (o.sourceId === "poc-github" && typeof o.metadata?.repoCount === "number" ? o.metadata.repoCount : 0)));
  const { verdict, reason } = evaluateVerdict(
    ladder,
    {
      exploitMaturity,
      epss: epss || undefined,
      kevRansomware: vulns.some((v) => v.kevCisaRansomware === true),
      vendor,
      product,
      cvss: cvss || undefined,
      // The newest CVE in the event decides how new the event is.
      daysSincePublished: ages.length ? Math.max(0, Math.min(...ages)) : undefined,
      pocRepoCount,
      reportedExploitationSources: reportedExploitationSources(obs),
    },
    rulesVersion,
  );
  return { ladder, exploitMaturity, verdict, verdictReason: reason, observationIds: obs.map((o) => o.id).sort((a, b) => a - b) };
}

export interface BuildOptions {
  rulesVersion?: string;
  now?: Date;
  /** Only clusters with a KEV addition inside this many days are returned. */
  lookbackDays?: number;
  /**
   * Early (pre-listing) events that already exist. When a KEV cluster contains CVEs they hold, the
   * cluster takes the id of the earliest of them, so the event keeps one id and one history from
   * the first early call through the listing.
   */
  earlyEvents?: { id: string; cveIds: string[]; firstSeenAt: string }[];
}

/**
 * Pure: vulnerabilities plus observations in, events with ladders and verdicts out.
 * Observations attach to events by CVE. Observations with no CVE are not attached in Phase 1.
 */
export function buildEvents(vulns: EventVuln[], observations: EventObservation[], opts: BuildOptions = {}): ComputedEvent[] {
  const rulesVersion = opts.rulesVersion ?? CURRENT_RULES_VERSION;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - (opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS) * DAY).toISOString().slice(0, 10);

  const byCve = new Map<string, EventObservation[]>();
  for (const o of observations) {
    for (const c of o.cveIds) (byCve.get(c.toUpperCase()) ?? byCve.set(c.toUpperCase(), []).get(c.toUpperCase())!).push(o);
  }

  const earlyOf = new Map<string, { id: string; firstSeenAt: string }>();
  for (const e of [...(opts.earlyEvents ?? [])].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt) || a.id.localeCompare(b.id))) {
    for (const c of e.cveIds) if (!earlyOf.has(c.toUpperCase())) earlyOf.set(c.toUpperCase(), e);
  }
  /** The earliest early event among these CVEs, if any. */
  const adoptId = (cveIds: string[]): string | undefined =>
    cveIds.map((c) => earlyOf.get(c)).filter((e): e is { id: string; firstSeenAt: string } => !!e).sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt) || a.id.localeCompare(b.id))[0]?.id;

  const usedIds = new Set<string>();
  const events: ComputedEvent[] = [];
  for (const c of clusterKev(vulns)) {
    if (c.lastDate < cutoff) continue;
    const base = ["kev", c.firstDate, slug(c.vendor ?? "unknown", 20), slug(c.product ?? "", 30)].filter(Boolean).join("-");
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);

    const cveIds = c.vulns.map((v) => v.cveId.toUpperCase()).sort();
    const seen = new Map<number, EventObservation>();
    for (const cve of cveIds) for (const o of byCve.get(cve) ?? []) seen.set(o.id, o);
    const a = assessGroup(c.vulns, [...seen.values()], c.vendor, c.product, now, rulesVersion);
    const first = c.vulns[0];
    events.push({
      id: adoptId(cveIds) ?? id,
      title: eventTitle(c),
      summary: clipSummary(first.description),
      vendor: c.vendor,
      product: c.product,
      cveIds,
      firstSeenAt: new Date(`${c.firstDate}T00:00:00Z`).toISOString(),
      ...a,
      rulesVersion,
    });
  }
  return events;
}

// ---------------------------------------------------------------------------------------------
// Early (pre-listing) events
// ---------------------------------------------------------------------------------------------

/** Evidence must be this recent for a CVE to get an early event. */
export const EARLY_WINDOW_DAYS = 30;
/** New early events created per run. Existing ones are always refreshed. */
export const MAX_NEW_EARLY_EVENTS_PER_RUN = 25;
export const EARLY_PREFIX = "early-";

export const earlyEventId = (cveId: string) => `${EARLY_PREFIX}${cveId.toLowerCase()}`;

/** An observation that qualifies a CVE for an early event: exploitation reported or confirmed, or confirmed attack attempts. */
export function isEarlyEvidence(o: { kind: string; strength: string }): boolean {
  if (o.kind === "exploited") return o.strength === "reported" || o.strength === "confirmed";
  return o.kind === "attempts" && o.strength === "confirmed";
}

export interface EarlyEvent extends ComputedEvent {
  /** Corroboration score used to pick which new events to create first when over the cap. */
  priority: number;
}

/**
 * Pure: one event per CVE that has exploitation or confirmed attack attempts in the last
 * EARLY_WINDOW_DAYS and is not in KEV. `vulns` holds the facts we have for those CVEs (a CVE with
 * no row is skipped: without a publish date the age rules cannot be applied honestly).
 * Returned in priority order: more separate reports and honeypot attempts first, then newest.
 */
export function buildEarlyEvents(
  vulns: EventVuln[],
  observations: (EventObservation & { observedAt?: Date | string | null; publishedAt?: Date | string | null })[],
  opts: { rulesVersion?: string; now?: Date } = {},
): { events: EarlyEvent[]; skippedNoAge: string[] } {
  const rulesVersion = opts.rulesVersion ?? CURRENT_RULES_VERSION;
  const now = opts.now ?? new Date();
  const since = now.getTime() - EARLY_WINDOW_DAYS * DAY;
  const when = (o: { observedAt?: Date | string | null; publishedAt?: Date | string | null }) => {
    const t = new Date((o.publishedAt ?? o.observedAt ?? now) as Date | string).getTime();
    return Number.isFinite(t) ? t : now.getTime();
  };

  const byCve = new Map<string, typeof observations>();
  for (const o of observations) for (const c of o.cveIds) (byCve.get(c.toUpperCase()) ?? byCve.set(c.toUpperCase(), []).get(c.toUpperCase())!).push(o);

  const out: EarlyEvent[] = [];
  const skippedNoAge: string[] = [];
  for (const v of vulns) {
    if (kevDate(v)) continue;
    const cve = v.cveId.toUpperCase();
    const obs = byCve.get(cve) ?? [];
    const qualifying = obs.filter((o) => isEarlyEvidence(o) && when(o) >= since);
    if (!qualifying.length) continue;
    if (!v.publishedAt) {
      skippedNoAge.push(cve);
      continue;
    }
    const a = assessGroup([v], obs, v.vendor ?? undefined, v.product ?? undefined, now, rulesVersion);
    const earliest = Math.min(...qualifying.map(when));
    const reports = qualifying.filter((o) => o.kind === "exploited").length;
    const honeypot = qualifying.some((o) => o.kind === "attempts") ? 1 : 0;
    out.push({
      id: earlyEventId(cve),
      title:
        plainTitle({ vendor: v.vendor, product: v.product, texts: [v.title, v.description], cwe: v.cwe ?? [], confirmed: false, fallbackName: cve }) ||
        v.title?.trim() ||
        [v.vendor, v.product, cve].filter(Boolean).join(" "),
      summary: clipSummary(v.description),
      vendor: v.vendor ?? undefined,
      product: v.product ?? undefined,
      cveIds: [cve],
      firstSeenAt: new Date(earliest).toISOString(),
      ...a,
      rulesVersion,
      priority: reports + honeypot * 2,
    });
  }
  out.sort((x, y) => y.priority - x.priority || y.firstSeenAt.localeCompare(x.firstSeenAt) || x.id.localeCompare(y.id));
  return { events: out, skippedNoAge };
}

/**
 * Shortens a source description to at most `max` characters for a readable summary. Ends at the
 * last full sentence that fits; failing that, at the last whole word with an ellipsis.
 */
export function clipSummary(text: string | null | undefined, max = 400): string | undefined {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\u00a0"));
  if (sentence >= max * 0.4) return head.slice(0, sentence + 1);
  const space = head.lastIndexOf(" ");
  return `${(space > 0 ? head.slice(0, space) : head).replace(/[\s,;:.-]+$/, "")}…`;
}
