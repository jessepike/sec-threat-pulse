import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { getJson } from "../http";

const BASE = "https://api.vulncheck.com/v3/index/vulncheck-kev";
const MAX_PAGES = 5;

interface VcEntry {
  vendorProject?: string;
  product?: string;
  shortDescription?: string;
  vulnerabilityName?: string;
  knownRansomwareCampaignUse?: string;
  cve?: string[];
  date_added?: string;
  cisa_date_added?: string;
  vulncheck_xdb?: { xdb_url?: string; date_added?: string; exploit_type?: string }[];
  vulncheck_reported_exploitation?: { url?: string; date_added?: string }[];
}

interface VcPage {
  _meta?: { next_cursor?: string | null; total_documents?: number };
  data?: VcEntry[];
}

export function parseVulncheck(entries: VcEntry[]): { observations: ObservationInput[]; vulnerabilities: VulnerabilityInput[] } {
  const observations: ObservationInput[] = [];
  const vulnerabilities: VulnerabilityInput[] = [];
  for (const e of entries) {
    for (const raw of e.cve ?? []) {
      const cve = raw.toUpperCase();
      const added = e.date_added?.slice(0, 10);
      const sources = (e.vulncheck_reported_exploitation ?? []).map((r) => r.url).filter(Boolean);
      observations.push({
        sourceId: "vulncheck-kev",
        dedupeKey: `vulncheck-kev:${cve}`,
        kind: "exploited",
        strength: "confirmed",
        cveIds: [cve],
        vendor: e.vendorProject,
        product: e.product,
        title: e.vulnerabilityName ?? `${cve} in VulnCheck KEV`,
        summary: e.shortDescription,
        url: `https://vulncheck.com/browse/cve/${cve}`,
        publishedAt: e.date_added,
        metadata: {
          reportedExploitation: sources.slice(0, 5),
          exploitLinks: (e.vulncheck_xdb ?? []).length,
        },
      });
      vulnerabilities.push({
        cveId: cve,
        title: e.vulnerabilityName,
        description: e.shortDescription,
        vendor: e.vendorProject,
        product: e.product,
        kevVulncheckDateAdded: added,
        kevCisaRansomware: e.knownRansomwareCampaignUse === "Known" ? true : undefined,
      });
    }
  }
  return { observations, vulnerabilities };
}

export const vulncheckKevAdapter: SourceAdapter = {
  id: "vulncheck-kev",
  name: "VulnCheck KEV",
  intervalMinutes: 180,
  async run(ctx): Promise<AdapterResult> {
    const token = (ctx.env ?? process.env).VULNCHECK_API_TOKEN;
    if (!token) return { observations: [], vulnerabilities: [], skipped: "VULNCHECK_API_TOKEN not set" };

    // Newest first, so the first page holds recent additions. Later runs re-read a few pages.
    const entries: VcEntry[] = [];
    let cursor: string | undefined;
    let first = true;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = first
        ? `${BASE}?start_cursor=true&limit=500`
        : `${BASE}?cursor=${encodeURIComponent(cursor!)}&limit=500`;
      const { data } = await getJson<VcPage>(ctx.fetch, url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        sleep: ctx.sleep,
      });
      entries.push(...(data.data ?? []));
      cursor = data._meta?.next_cursor ?? undefined;
      first = false;
      if (!cursor || !data.data?.length) break;
    }
    return { ...parseVulncheck(entries), raw: { body: JSON.stringify({ count: entries.length }), contentType: "application/json" } };
  },
};
