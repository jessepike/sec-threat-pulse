import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { httpGet } from "../http";

export const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const KEV_MIRROR_URL =
  "https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json";

interface KevEntry {
  cveID: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  forensicTriage?: string;
  notes?: string;
  cwes?: string[];
}

interface KevCatalog {
  catalogVersion?: string;
  dateReleased?: string;
  vulnerabilities: KevEntry[];
}

export function parseKev(catalog: KevCatalog): { observations: ObservationInput[]; vulnerabilities: VulnerabilityInput[] } {
  const observations: ObservationInput[] = [];
  const vulnerabilities: VulnerabilityInput[] = [];
  for (const v of catalog.vulnerabilities ?? []) {
    const cve = v.cveID?.trim().toUpperCase();
    if (!cve) continue;
    const ransomware = v.knownRansomwareCampaignUse === "Known";
    const published = v.dateAdded ? new Date(`${v.dateAdded}T00:00:00Z`) : undefined;
    const publishedAt = published && !Number.isNaN(published.getTime()) ? published.toISOString() : undefined;
    observations.push({
      sourceId: "cisa-kev",
      dedupeKey: `cisa-kev:${cve}`,
      kind: "exploited",
      strength: "confirmed",
      cveIds: [cve],
      vendor: v.vendorProject,
      product: v.product,
      title: v.vulnerabilityName ?? `${cve} added to CISA KEV`,
      summary: v.shortDescription,
      url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=${cve}`,
      publishedAt,
      metadata: {
        dueDate: v.dueDate,
        ransomware: v.knownRansomwareCampaignUse,
        forensicTriage: v.forensicTriage,
        cwes: v.cwes,
      },
    });
    vulnerabilities.push({
      cveId: cve,
      title: v.vulnerabilityName,
      description: v.shortDescription,
      vendor: v.vendorProject,
      product: v.product,
      cwe: v.cwes?.length ? v.cwes : undefined,
      kevCisaDateAdded: v.dateAdded,
      kevCisaRansomware: ransomware,
    });
  }
  return { observations, vulnerabilities };
}

export const cisaKevAdapter: SourceAdapter = {
  id: "cisa-kev",
  name: "CISA Known Exploited Vulnerabilities",
  intervalMinutes: 60,
  async run(ctx): Promise<AdapterResult> {
    let res;
    try {
      res = await httpGet(ctx.fetch, KEV_URL, { sleep: ctx.sleep });
    } catch {
      res = await httpGet(ctx.fetch, KEV_MIRROR_URL, { sleep: ctx.sleep });
    }
    const catalog = JSON.parse(res.body) as KevCatalog;
    if (!Array.isArray(catalog.vulnerabilities)) throw new Error("KEV payload has no vulnerabilities array");
    const version = catalog.catalogVersion;
    // Same catalog version as last run: nothing new to write.
    if (version && ctx.cursor === version) {
      return { observations: [], vulnerabilities: [], cursor: version };
    }
    const parsed = parseKev(catalog);
    return { ...parsed, raw: { body: res.body, contentType: "application/json" }, cursor: version };
  },
};
