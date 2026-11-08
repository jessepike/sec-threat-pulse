import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { httpGet } from "../http";
import { isoOrUndefined, mapLimit, pickBatch } from "../util";

const HEAD = 40;
const ROTATING = 60;

export function cvePath(cve: string): string | undefined {
  const m = cve.match(/^CVE-(\d{4})-(\d{4,})$/i);
  if (!m) return undefined;
  const bucket = `${Math.floor(Number(m[2]) / 1000)}xxx`;
  return `${m[1]}/${bucket}/CVE-${m[1]}-${m[2]}.json`;
}

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

/** Read SSVC options from a CISA ADP container. */
export function readSsvc(record: Json): { exploitation?: string; automatable?: string; technicalImpact?: string; timestamp?: string } {
  const adp = arr((record.containers as Json | undefined)?.adp);
  for (const c of adp) {
    for (const m of arr(c.metrics)) {
      const other = m.other as Json | undefined;
      if (other?.type !== "ssvc") continue;
      const options = arr((other.content as Json | undefined)?.options);
      const out: Record<string, string> = {};
      for (const o of options) for (const [k, v] of Object.entries(o)) out[k] = String(v);
      const timestamp = isoOrUndefined((other.content as Json | undefined)?.timestamp as string | undefined);
      return {
        timestamp,
        exploitation: out["Exploitation"]?.toLowerCase(),
        automatable: out["Automatable"]?.toLowerCase(),
        technicalImpact: out["Technical Impact"]?.toLowerCase(),
      };
    }
  }
  return {};
}

function readCvss(record: Json): number | undefined {
  const containers = record.containers as Json | undefined;
  const all = [containers?.cna as Json | undefined, ...arr(containers?.adp)].filter(Boolean) as Json[];
  for (const key of ["cvssV4_0", "cvssV3_1", "cvssV3_0"]) {
    for (const c of all) {
      for (const m of arr(c.metrics)) {
        const x = m[key] as Json | undefined;
        if (typeof x?.baseScore === "number") return x.baseScore;
      }
    }
  }
  return undefined;
}

export function parseCveRecord(cve: string, record: Json): { observations: ObservationInput[]; vulnerability: VulnerabilityInput } {
  const containers = record.containers as Json | undefined;
  const cna = (containers?.cna ?? {}) as Json;
  const meta = (record.cveMetadata ?? {}) as Json;
  const affectedAll = arr(cna.affected);
  const affected = affectedAll[0];
  const cpes: string[] = [];
  for (const a of affectedAll) {
    if (typeof a.vendor !== "string" || typeof a.product !== "string" || a.vendor === "n/a" || a.product === "n/a") continue;
    const pair = `${a.vendor.trim().toLowerCase()}/${a.product.trim().toLowerCase()}`;
    if (cpes.length < 60 && !cpes.includes(pair)) cpes.push(pair);
  }
  const desc = arr(cna.descriptions).find((d) => d.lang === "en" || String(d.lang).startsWith("en")) ?? arr(cna.descriptions)[0];
  const cwes: string[] = [];
  for (const pt of arr(cna.problemTypes)) for (const d of arr(pt.descriptions)) if (typeof d.cweId === "string") cwes.push(d.cweId);
  const vulnerability: VulnerabilityInput = {
    cveId: cve,
    title: typeof cna.title === "string" ? cna.title : undefined,
    description: typeof desc?.value === "string" ? desc.value : undefined,
    vendor: typeof affected?.vendor === "string" && affected.vendor !== "n/a" ? affected.vendor : undefined,
    product: typeof affected?.product === "string" && affected.product !== "n/a" ? affected.product : undefined,
    cvssScore: readCvss(record),
    cwe: cwes.length ? [...new Set(cwes)] : undefined,
    publishedAt: isoOrUndefined(meta.datePublished),
    cpes: cpes.length ? cpes : undefined,
  };
  const observations: ObservationInput[] = [];
  const ssvc = readSsvc(record);
  // The SSVC decision carries its own timestamp. That is when CISA made the call, so it dates the
  // observation; the CVE publish date is only a fallback for display and never sets the clock.
  const reportedAt = ssvc.timestamp;
  const url = `https://www.cve.org/CVERecord?id=${cve}`;
  if (ssvc.exploitation === "active") {
    observations.push({
      sourceId: "cvelist",
      dedupeKey: `cvelist-ssvc:${cve}:active`,
      kind: "exploited",
      strength: "confirmed",
      cveIds: [cve],
      vendor: vulnerability.vendor,
      product: vulnerability.product,
      title: `CISA Vulnrichment marks ${cve} as actively exploited`,
      url,
      publishedAt: reportedAt ?? vulnerability.publishedAt,
      metadata: { ssvc, reportedAt },
    });
  } else if (ssvc.exploitation === "poc") {
    observations.push({
      sourceId: "cvelist",
      dedupeKey: `cvelist-ssvc:${cve}:poc`,
      kind: "exploit_available",
      strength: "reported",
      cveIds: [cve],
      vendor: vulnerability.vendor,
      product: vulnerability.product,
      title: `CISA Vulnrichment notes a public proof of concept for ${cve}`,
      url,
      publishedAt: reportedAt ?? vulnerability.publishedAt,
      metadata: { ssvc, maturity: "poc", reportedAt },
    });
    vulnerability.exploitMaturity = "poc";
  }
  return { observations, vulnerability };
}

export const cvelistAdapter: SourceAdapter = {
  id: "cvelist",
  name: "CVE List V5 and CISA Vulnrichment",
  intervalMinutes: 60,
  async run(ctx): Promise<AdapterResult> {
    const tracked = ctx.trackedCves ?? [];
    const offset = Number(ctx.cursor ?? 0) || 0;
    const { batch, nextOffset } = pickBatch(tracked, offset, HEAD, ROTATING);
    const observations: ObservationInput[] = [];
    const vulnerabilities: VulnerabilityInput[] = [];
    let missing = 0;
    await mapLimit(batch, 8, async (cve) => {
      const path = cvePath(cve);
      if (!path) return;
      const res = await httpGet(ctx.fetch, `https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/${path}`, {
        allowStatus: [404],
        sleep: ctx.sleep,
      });
      if (!res.ok) {
        missing++;
        return;
      }
      const parsed = parseCveRecord(cve, JSON.parse(res.body));
      observations.push(...parsed.observations);
      vulnerabilities.push(parsed.vulnerability);
    });
    return {
      observations,
      vulnerabilities,
      cursor: String(nextOffset),
      raw: { body: JSON.stringify({ requested: batch.length, missing }), contentType: "application/json" },
    };
  },
};
