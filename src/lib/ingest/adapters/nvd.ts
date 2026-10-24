import type { AdapterResult, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { defaultSleep, getJson } from "../http";
import { isoOrUndefined } from "../util";

const BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

export function parseNvdCve(cve: Json): VulnerabilityInput | undefined {
  const id = typeof cve.id === "string" ? cve.id.toUpperCase() : undefined;
  if (!id) return undefined;
  const metrics = (cve.metrics ?? {}) as Json;
  let cvss: number | undefined;
  for (const key of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const list = arr(metrics[key]);
    const pick = list.find((m) => m.type === "Primary") ?? list[0];
    const score = (pick?.cvssData as Json | undefined)?.baseScore;
    if (typeof score === "number") {
      cvss = score;
      break;
    }
  }
  const desc = arr(cve.descriptions).find((d) => d.lang === "en");
  const cwes: string[] = [];
  for (const w of arr(cve.weaknesses)) for (const d of arr(w.description)) if (typeof d.value === "string" && d.value.startsWith("CWE-")) cwes.push(d.value);
  let vendor: string | undefined;
  let product: string | undefined;
  outer: for (const conf of arr(cve.configurations)) {
    for (const node of arr(conf.nodes)) {
      for (const m of arr(node.cpeMatch)) {
        if (m.vulnerable !== true || typeof m.criteria !== "string") continue;
        const parts = m.criteria.split(":");
        if (parts.length > 4 && parts[3] !== "*" && parts[4] !== "*") {
          vendor = parts[3];
          product = parts[4];
          break outer;
        }
      }
    }
  }
  return {
    cveId: id,
    description: typeof desc?.value === "string" ? desc.value : undefined,
    cvssScore: cvss,
    cwe: cwes.length ? [...new Set(cwes)] : undefined,
    publishedAt: isoOrUndefined(typeof cve.published === "string" ? `${cve.published}Z` : undefined),
    vendor,
    product,
  };
}

export const nvdAdapter: SourceAdapter = {
  id: "nvd",
  name: "NVD API 2.0",
  intervalMinutes: 120,
  async run(ctx): Promise<AdapterResult> {
    const env = ctx.env ?? process.env;
    const key = env.NVD_API_KEY;
    const sleep = ctx.sleep ?? defaultSleep;
    // NVD allows 5 requests per 30 s without a key and 50 with one.
    const gap = key ? 700 : 6500;
    const headers: Record<string, string> = key ? { apiKey: key } : {};
    const tracked = new Set(ctx.trackedCves ?? []);
    const out = new Map<string, VulnerabilityInput>();
    let requests = 0;

    const call = async (qs: string) => {
      if (requests++ > 0) await sleep(gap);
      return getJson<{ vulnerabilities?: { cve: Json }[]; totalResults?: number }>(ctx.fetch, `${BASE}?${qs}`, { headers, sleep: ctx.sleep });
    };

    // 1) Targeted lookups for tracked CVEs that still lack CVSS or a description.
    const lookups = (ctx.enrichCves ?? []).slice(0, key ? 40 : 8);
    for (const cve of lookups) {
      const { data } = await call(`cveId=${encodeURIComponent(cve)}`);
      for (const v of data.vulnerabilities ?? []) {
        const parsed = parseNvdCve(v.cve);
        if (parsed) out.set(parsed.cveId, parsed);
      }
    }

    // 2) Recently modified CVEs, kept only when we track them.
    const end = ctx.now;
    const earliest = new Date(end.getTime() - 100 * 86400000);
    const sinceParsed = ctx.cursor ? new Date(ctx.cursor) : new Date(end.getTime() - 86400000);
    const since = sinceParsed < earliest ? earliest : sinceParsed;
    const fmt = (d: Date) => d.toISOString().replace("Z", "");
    let startIndex = 0;
    for (let page = 0; page < 3; page++) {
      const { data } = await call(
        `lastModStartDate=${fmt(since)}&lastModEndDate=${fmt(end)}&resultsPerPage=2000&startIndex=${startIndex}`,
      );
      const list = data.vulnerabilities ?? [];
      for (const v of list) {
        const parsed = parseNvdCve(v.cve);
        if (parsed && tracked.has(parsed.cveId)) out.set(parsed.cveId, parsed);
      }
      startIndex += list.length;
      if (!list.length || startIndex >= (data.totalResults ?? 0)) break;
    }

    return {
      observations: [],
      vulnerabilities: [...out.values()],
      cursor: end.toISOString(),
      raw: { body: JSON.stringify({ enriched: out.size }), contentType: "application/json" },
    };
  },
};
