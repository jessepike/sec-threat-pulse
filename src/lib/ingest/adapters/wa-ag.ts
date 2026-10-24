import type { AdapterResult, ObservationInput, SourceAdapter } from "@/lib/ladder/types";
import { getJson } from "../http";
import { isoOrUndefined } from "../util";

const URL_ = `https://data.wa.gov/resource/sb4j-ca4h.json?$order=${encodeURIComponent("datesubmitted DESC")}&$limit=200`;

interface Row {
  id?: string;
  name?: string;
  datesubmitted?: string;
  databreachcause?: string;
  cyberattacktype?: string;
  washingtoniansaffected?: string;
  industrytype?: string;
  datestart?: string;
  dateaware?: string;
}

export function parseWaAg(rows: Row[], sinceIso?: string): ObservationInput[] {
  const out: ObservationInput[] = [];
  for (const r of rows) {
    if (!r.id || !r.name) continue;
    const submitted = isoOrUndefined(r.datesubmitted ? `${r.datesubmitted}Z` : undefined);
    if (sinceIso && submitted && submitted < sinceIso) continue;
    const bits = [
      r.databreachcause && `Cause: ${r.databreachcause}.`,
      r.cyberattacktype && `Attack type: ${r.cyberattacktype}.`,
      r.washingtoniansaffected && `Washingtonians affected: ${Number(r.washingtoniansaffected).toLocaleString("en-US")}.`,
      r.industrytype && `Sector: ${r.industrytype}.`,
    ].filter(Boolean);
    out.push({
      sourceId: "wa-ag",
      dedupeKey: `wa-ag:${r.id}`,
      kind: "damage",
      strength: "confirmed",
      cveIds: [],
      orgName: r.name.trim(),
      title: `${r.name.trim()} reported a data breach to the Washington Attorney General`,
      summary: bits.join(" ") || undefined,
      url: "https://www.atg.wa.gov/data-breach-notifications",
      publishedAt: submitted,
      metadata: {
        cause: r.databreachcause,
        attackType: r.cyberattacktype,
        affected: r.washingtoniansaffected ? Number(r.washingtoniansaffected) : undefined,
        industry: r.industrytype,
        breachStart: r.datestart,
        aware: r.dateaware,
      },
    });
  }
  return out;
}

export const waAgAdapter: SourceAdapter = {
  id: "wa-ag",
  name: "Washington Attorney General breach notices",
  intervalMinutes: 1440,
  async run(ctx): Promise<AdapterResult> {
    const { data, res } = await getJson<Row[]>(ctx.fetch, URL_, { sleep: ctx.sleep });
    if (!Array.isArray(data)) throw new Error("WA AG response is not an array");
    const obs = parseWaAg(data, ctx.cursor);
    const newest = data.map((r) => isoOrUndefined(r.datesubmitted ? `${r.datesubmitted}Z` : undefined) ?? "").sort().pop();
    return {
      observations: obs,
      vulnerabilities: [],
      cursor: newest || ctx.cursor,
      raw: { body: res.body, contentType: "application/json" },
    };
  },
};
