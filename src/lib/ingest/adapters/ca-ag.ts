import type { AdapterResult, ObservationInput, SourceAdapter } from "@/lib/ladder/types";
import { httpGet } from "../http";
import { parseCsv, slugify, usDateToIso } from "../util";

const URL_ = "https://oag.ca.gov/privacy/databreach/list-export";
const FIRST_RUN_DAYS = 90;

export function parseCaAg(csv: string, sinceIso?: string): ObservationInput[] {
  const [head, ...rows] = parseCsv(csv);
  if (!head) return [];
  const out: ObservationInput[] = [];
  for (const r of rows) {
    const org = r[0]?.trim();
    const reported = usDateToIso(r[2]);
    if (!org || !reported) continue;
    if (sinceIso && reported < sinceIso) continue;
    out.push({
      sourceId: "ca-ag",
      dedupeKey: `ca-ag:${slugify(org)}:${reported.slice(0, 10)}`,
      kind: "damage",
      strength: "confirmed",
      cveIds: [],
      orgName: org,
      title: `${org} filed a data breach notice with the California Attorney General`,
      summary: r[1]?.trim() ? `Breach dates given: ${r[1].trim()}.` : undefined,
      url: "https://oag.ca.gov/privacy/databreach/list",
      publishedAt: reported,
      metadata: { breachDates: r[1]?.trim() || undefined },
    });
  }
  return out;
}

export const caAgAdapter: SourceAdapter = {
  id: "ca-ag",
  name: "California Attorney General breach notices",
  intervalMinutes: 1440,
  async run(ctx): Promise<AdapterResult> {
    const res = await httpGet(ctx.fetch, URL_, { headers: { Accept: "text/csv" }, sleep: ctx.sleep });
    if (!/Organization Name/i.test(res.body.slice(0, 200))) throw new Error("CA AG export has unexpected header");
    const since = ctx.cursor ?? new Date(ctx.now.getTime() - FIRST_RUN_DAYS * 86400000).toISOString();
    const obs = parseCaAg(res.body, since);
    const newest = obs.map((o) => o.publishedAt ?? "").sort().pop();
    return {
      observations: obs,
      vulnerabilities: [],
      cursor: newest && newest > since ? newest : since,
      raw: { body: res.body, contentType: "text/csv" },
    };
  },
};
