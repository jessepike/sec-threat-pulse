import type { AdapterResult, ObservationInput, SourceAdapter } from "@/lib/ladder/types";
import { httpGet } from "../http";
import { isCveId, parseCsv, truncate } from "../util";

// CISA ICS advisories (industrial and medical products), as CSAF 2.0 documents in CISA's own
// public repository (github.com/cisagov/CSAF). US government work, no key. The OT folder's
// changes.csv lists every document path with its last change, newest first. Each advisory that
// names CVEs becomes one observation per CVE: kind `advisory`, strength `reported`, like the other
// government advisories. Keyed per CVE so a revision that adds a CVE adds its evidence. We store the advisory id, title, vendor, product, CVE ids and the link
// to CISA's page; no advisory text. No vulnerability facts are written: republished vendor
// advisories (Siemens shipping Palo Alto Networks code) would put the wrong vendor on the CVE.

export const CISA_ICS_BASE = "https://raw.githubusercontent.com/cisagov/CSAF/develop/csaf_files/OT/white/";
export const CISA_ICS_CHANGES_URL = `${CISA_ICS_BASE}changes.csv`;
/** Documents changed within this many days are read. */
export const CISA_ICS_LOOKBACK_DAYS = 30;
/** At most this many documents are fetched per run; the rest wait for the next run. */
export const CISA_ICS_MAX_DOCS = 25;
/**
 * Republished vendor roll-ups can list hundreds of CVEs (Siemens bundles with 400+). One headline
 * is not talk about each of them, so a document with more CVEs than this is counted and skipped.
 */
export const CISA_ICS_MAX_CVES = 50;

interface CsafBranch {
  category?: string;
  name?: string;
  branches?: CsafBranch[];
}

export interface CsafDocument {
  document?: {
    title?: string;
    tracking?: { id?: string; initial_release_date?: string; current_release_date?: string };
    references?: { category?: string; url?: string }[];
  };
  product_tree?: { branches?: CsafBranch[] };
  vulnerabilities?: { cve?: string }[];
}

/** First branch of a category, searched depth first. */
function firstBranch(branches: CsafBranch[] | undefined, category: string): CsafBranch | undefined {
  for (const b of branches ?? []) {
    if (b.category === category) return b;
    const inner = firstBranch(b.branches, category);
    if (inner) return inner;
  }
  return undefined;
}

const iso = (d: string | undefined) => {
  const t = Date.parse(d ?? "");
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/** CISA's web page for the advisory, else the CSAF file itself. */
function advisoryUrl(doc: CsafDocument, path: string): string {
  const refs = doc.document?.references ?? [];
  const page = refs.find((r) => r.category === "self" && /^https:\/\/www\.cisa\.gov\//.test(r.url ?? ""));
  return page?.url ?? `${CISA_ICS_BASE}${path}`;
}

export type CsafParse =
  | { skip: "no-cve" | "rollup" | "no-id"; cves: number }
  | { observations: ObservationInput[] };

/** One CSAF document to one observation per CVE. Pure: no network. */
export function parseCsafAdvisory(doc: CsafDocument, path: string): CsafParse {
  const id = doc.document?.tracking?.id?.trim().toUpperCase();
  const cves = [...new Set((doc.vulnerabilities ?? []).map((v) => v.cve?.trim().toUpperCase() ?? "").filter(isCveId))];
  if (!id) return { skip: "no-id", cves: cves.length };
  if (cves.length === 0) return { skip: "no-cve", cves: 0 };
  if (cves.length > CISA_ICS_MAX_CVES) return { skip: "rollup", cves: cves.length };
  const vendor = firstBranch(doc.product_tree?.branches, "vendor")?.name?.trim() || undefined;
  const product = firstBranch(doc.product_tree?.branches, "product_name")?.name?.trim() || undefined;
  const title = doc.document?.title?.trim() || product || id;
  const publishedAt = iso(doc.document?.tracking?.initial_release_date) ?? iso(doc.document?.tracking?.current_release_date);
  return {
    observations: cves.map((cve) => ({
      sourceId: "cisa-ics",
      dedupeKey: `cisa-ics:${id}:${cve}`,
      kind: "advisory" as const,
      strength: "reported" as const,
      cveIds: [cve],
      vendor,
      product,
      title: truncate(`CISA ICS advisory ${id}: ${title}`, 300),
      url: advisoryUrl(doc, path),
      publishedAt,
      metadata: { advisory: id, path, revisedAt: iso(doc.document?.tracking?.current_release_date), advisoryCves: cves.length },
    })),
  };
}

/** changes.csv rows ("2026/icsa-26-316-05.json","2026-11-12T07:00:00Z"), newest first. */
export function parseChanges(csv: string): { path: string; changedAt: string }[] {
  return parseCsv(csv)
    .map(([path, at]) => ({ path: path?.trim() ?? "", changedAt: at?.trim() ?? "" }))
    .filter((r) => /^\d{4}\/[a-z0-9-]+\.json$/i.test(r.path) && !Number.isNaN(Date.parse(r.changedAt)))
    .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
}

/** Cursor: changes.csv ETag and the change time of each document already read. */
interface Cursor {
  e?: string;
  seen?: Record<string, string>;
}

function readCursor(c: string | undefined): Cursor {
  try {
    const o = c ? (JSON.parse(c) as Cursor) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export const cisaIcsAdapter: SourceAdapter = {
  id: "cisa-ics",
  name: "CISA ICS advisories",
  intervalMinutes: 180,
  async run(ctx): Promise<AdapterResult> {
    const cur = readCursor(ctx.cursor);
    const seen = cur.seen ?? {};
    const res = await httpGet(ctx.fetch, CISA_ICS_CHANGES_URL, { etag: cur.e, sleep: ctx.sleep, headers: { Accept: "text/csv, text/plain;q=0.9, */*;q=0.5" } });
    if (res.notModified) return { observations: [], vulnerabilities: [], cursor: ctx.cursor, stats: { notModified: 1 } };
    const rows = parseChanges(res.body);
    if (rows.length === 0) throw new Error("CISA ICS changes.csv has no rows");
    const since = ctx.now.getTime() - CISA_ICS_LOOKBACK_DAYS * 86_400_000;
    const recent = rows.filter((r) => Date.parse(r.changedAt) >= since);
    const todo = recent.filter((r) => seen[r.path] !== r.changedAt);
    const batch = todo.slice(0, CISA_ICS_MAX_DOCS);
    const next: Record<string, string> = {};
    for (const r of recent) if (seen[r.path] === r.changedAt) next[r.path] = r.changedAt;
    const out: AdapterResult = { observations: [], vulnerabilities: [] };
    const stats = { documents: batch.length, waiting: todo.length - batch.length, withCve: 0, noCve: 0, noId: 0, rollup: 0, gone: 0, failed: 0 };
    let lastError: unknown;
    for (const r of batch) {
      // One bad document must not stop the others: a failed one stays out of the cursor and is retried next run.
      let doc: CsafDocument;
      try {
        const d = await httpGet(ctx.fetch, `${CISA_ICS_BASE}${r.path}`, { sleep: ctx.sleep, allowStatus: [404], headers: { Accept: "application/json" } });
        if (d.status === 404) {
          // Removed from the repository: nothing to read, do not ask again for this change.
          next[r.path] = r.changedAt;
          stats.gone++;
          continue;
        }
        doc = JSON.parse(d.body) as CsafDocument;
      } catch (e) {
        stats.failed++;
        lastError = e;
        continue;
      }
      const parsed = parseCsafAdvisory(doc ?? {}, r.path);
      next[r.path] = r.changedAt;
      if ("skip" in parsed) {
        stats[parsed.skip === "rollup" ? "rollup" : parsed.skip === "no-id" ? "noId" : "noCve"]++;
        continue;
      }
      stats.withCve++;
      out.observations.push(...parsed.observations);
    }
    if (batch.length > 0 && stats.failed === batch.length) {
      throw new Error(`CISA ICS: every document fetch failed (${stats.failed}): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    }
    // Keep the ETag only once every recent document is read, so a capped or partly failed run is not skipped as unchanged next time.
    const cursor: Cursor = { seen: next, ...(stats.waiting === 0 && stats.failed === 0 && res.etag ? { e: res.etag } : {}) };
    return { ...out, cursor: JSON.stringify(cursor), stats };
  },
};
