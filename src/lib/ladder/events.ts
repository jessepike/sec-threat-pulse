import { computeExploitMaturity, computeLadder, reportedExploitationSources, type LadderObservation } from "./compute";
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
  if (c.vulns.length === 1) {
    const v = c.vulns[0];
    return v.title?.trim() || [c.vendor, c.product, v.cveId].filter(Boolean).join(" ");
  }
  const name = [c.vendor, c.product].filter((x, i, a) => x && (i === 0 || !x.toLowerCase().includes(a[0]!.toLowerCase()))).join(" ");
  return `${name || "Multiple products"}: ${c.vulns.length} vulnerabilities exploited`;
}

export interface BuildOptions {
  rulesVersion?: string;
  now?: Date;
  /** Only clusters with a KEV addition inside this many days are returned. */
  lookbackDays?: number;
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
    const obs = [...seen.values()];

    const ladder = computeLadder(obs);
    const exploitMaturity = computeExploitMaturity(obs, c.vulns.map((v) => v.exploitMaturity));
    const epss = Math.max(0, ...c.vulns.map((v) => v.epss ?? 0));
    const cvss = Math.max(0, ...c.vulns.map((v) => v.cvssScore ?? 0));
    const ages = c.vulns.map((v) => (v.publishedAt ? Math.floor((now.getTime() - new Date(v.publishedAt).getTime()) / DAY) : undefined)).filter((n): n is number => n !== undefined && Number.isFinite(n));
    const pocRepoCount = Math.max(0, ...obs.map((o) => (o.sourceId === "poc-github" && typeof o.metadata?.repoCount === "number" ? o.metadata.repoCount : 0)));
    const { verdict, reason } = evaluateVerdict(
      ladder,
      {
        exploitMaturity,
        epss: epss || undefined,
        kevRansomware: c.vulns.some((v) => v.kevCisaRansomware === true),
        vendor: c.vendor,
        product: c.product,
        cvss: cvss || undefined,
        // The newest CVE in the event decides how new the event is.
        daysSincePublished: ages.length ? Math.max(0, Math.min(...ages)) : undefined,
        pocRepoCount,
        reportedExploitationSources: reportedExploitationSources(obs),
      },
      rulesVersion,
    );
    const first = c.vulns[0];
    events.push({
      id,
      title: eventTitle(c),
      summary: first.description?.slice(0, 400) || undefined,
      vendor: c.vendor,
      product: c.product,
      cveIds,
      firstSeenAt: new Date(`${c.firstDate}T00:00:00Z`).toISOString(),
      ladder,
      exploitMaturity,
      verdict,
      verdictReason: reason,
      rulesVersion,
      observationIds: obs.map((o) => o.id).sort((a, b) => a - b),
    });
  }
  return events;
}
