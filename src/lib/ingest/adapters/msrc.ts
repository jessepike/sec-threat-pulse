import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { getJson } from "../http";

// Microsoft Security Response Center, CVRF API v3.0. Public, no key.
// Each monthly release (and its out-of-band revisions) is one CVRF document. Its per-CVE "Exploit
// Status" threat (Type 1) reads like "Publicly Disclosed:No;Exploited:Yes;Latest Software
// Release:Exploitation Detected". "Exploited:Yes" is the vendor confirming attacks: rung 4,
// confirmed. "Exploitation More Likely" is a forecast and is not used.

export const MSRC_UPDATES_URL = "https://api.msrc.microsoft.com/cvrf/v3.0/updates";
/** Documents released or revised within this many days are read each run. */
export const MSRC_LOOKBACK_DAYS = 70;

interface MsrcUpdate {
  ID: string;
  DocumentTitle?: string;
  InitialReleaseDate?: string;
  CurrentReleaseDate?: string;
  CvrfUrl?: string;
}

interface CvrfThreat {
  Type?: number;
  Description?: { Value?: string };
  ProductID?: string[];
}

interface CvrfVulnerability {
  CVE?: string;
  Title?: { Value?: string };
  Threats?: CvrfThreat[];
  RevisionHistory?: { Date?: string; Description?: { Value?: string } }[];
}

export interface CvrfDocument {
  DocumentTitle?: { Value?: string };
  Vulnerability?: CvrfVulnerability[];
}

const IMPACT = /\s+(remote code execution|elevation of privilege|security feature bypass|information disclosure|denial of service|spoofing|tampering)\s+vulnerability\s*$/i;

/** "Windows Common Log File System Driver Elevation of Privilege Vulnerability" to "Windows Common Log File System Driver". */
export function msrcComponent(title: string | undefined): string | undefined {
  const t = title?.trim();
  if (!t) return undefined;
  const stripped = t.replace(IMPACT, "").replace(/\s+vulnerability\s*$/i, "").trim();
  return stripped || undefined;
}

/** True when an Exploit Status threat says "Exploited:Yes". */
export function isExploited(v: CvrfVulnerability): boolean {
  return (v.Threats ?? []).some((t) => t.Type === 1 && /(^|;)\s*Exploited\s*:\s*Yes\s*(;|$)/i.test(t.Description?.Value ?? ""));
}

const iso = (d: string | undefined) => {
  if (!d) return undefined;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/** Exploited CVEs in one CVRF document. */
export function parseCvrf(doc: CvrfDocument, docId: string): { observations: ObservationInput[]; vulnerabilities: VulnerabilityInput[] } {
  const observations: ObservationInput[] = [];
  const vulnerabilities: VulnerabilityInput[] = [];
  for (const v of doc.Vulnerability ?? []) {
    const cve = v.CVE?.trim().toUpperCase();
    if (!cve || !/^CVE-\d{4}-\d{4,}$/.test(cve) || !isExploited(v)) continue;
    const dates = (v.RevisionHistory ?? []).map((r) => iso(r.Date)).filter((d): d is string => !!d).sort();
    const title = v.Title?.Value?.trim() || `${cve} (Microsoft)`;
    // Edge ships Chromium, and Microsoft republishes Google's Chromium CVEs: those are Google's flaws.
    const chromium = /^chromium:/i.test(title);
    const vendor = chromium ? "Google" : "Microsoft";
    const component = chromium ? "Chromium" : msrcComponent(v.Title?.Value);
    observations.push({
      sourceId: "msrc",
      dedupeKey: `msrc:${cve}`,
      kind: "exploited",
      strength: "confirmed",
      cveIds: [cve],
      vendor,
      product: component,
      title: `Microsoft confirms exploitation: ${title}`,
      url: `https://msrc.microsoft.com/update-guide/vulnerability/${cve}`,
      // The flag can be added in a later revision, so date it by the newest revision: never earlier than Microsoft said it.
      publishedAt: dates.at(-1),
      metadata: { document: docId, revisions: dates.length },
    });
    vulnerabilities.push({ cveId: cve, title, vendor, product: component, publishedAt: dates[0] });
  }
  return { observations, vulnerabilities };
}

/** Cursor: CurrentReleaseDate per document already read. */
type Cursor = Record<string, string>;

export const msrcAdapter: SourceAdapter = {
  id: "msrc",
  name: "Microsoft Security Response Center",
  intervalMinutes: 180,
  async run(ctx): Promise<AdapterResult> {
    const headers = { Accept: "application/json" };
    const { data } = await getJson<{ value?: MsrcUpdate[] }>(ctx.fetch, MSRC_UPDATES_URL, { sleep: ctx.sleep, headers });
    if (!Array.isArray(data?.value)) throw new Error("MSRC updates payload has no value array");
    let seen: Cursor = {};
    try {
      seen = ctx.cursor ? (JSON.parse(ctx.cursor) as Cursor) : {};
    } catch {
      seen = {};
    }
    const since = ctx.now.getTime() - MSRC_LOOKBACK_DAYS * 86_400_000;
    const recent = data.value.filter((u) => u.CvrfUrl && Date.parse(u.CurrentReleaseDate ?? u.InitialReleaseDate ?? "") >= since);
    const next: Cursor = {};
    const out: AdapterResult = { observations: [], vulnerabilities: [] };
    for (const u of recent) {
      const rev = u.CurrentReleaseDate ?? u.InitialReleaseDate ?? "";
      next[u.ID] = rev;
      if (seen[u.ID] === rev) continue;
      const { data: doc } = await getJson<CvrfDocument>(ctx.fetch, u.CvrfUrl!, { sleep: ctx.sleep, headers, timeoutMs: 60_000 });
      const parsed = parseCvrf(doc ?? {}, u.ID);
      out.observations.push(...parsed.observations);
      out.vulnerabilities.push(...parsed.vulnerabilities);
    }
    return { ...out, cursor: JSON.stringify(next) };
  },
};
