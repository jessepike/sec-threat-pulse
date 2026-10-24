import type { AdapterResult, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { getJson } from "../http";

const BATCH = 100;

interface EpssResponse {
  data?: { cve: string; epss: string; percentile: string; date: string }[];
}

export const epssAdapter: SourceAdapter = {
  id: "epss",
  name: "FIRST EPSS",
  intervalMinutes: 1440,
  async run(ctx): Promise<AdapterResult> {
    const tracked = ctx.trackedCves ?? [];
    const vulnerabilities: VulnerabilityInput[] = [];
    let fetched = 0;
    for (let i = 0; i < tracked.length; i += BATCH) {
      const chunk = tracked.slice(i, i + BATCH);
      const { data } = await getJson<EpssResponse>(
        ctx.fetch,
        `https://api.first.org/data/v1/epss?cve=${chunk.join(",")}&limit=${BATCH}`,
        { sleep: ctx.sleep },
      );
      for (const row of data.data ?? []) {
        const epss = Number(row.epss);
        const pct = Number(row.percentile);
        if (!Number.isFinite(epss)) continue;
        fetched++;
        vulnerabilities.push({
          cveId: row.cve.toUpperCase(),
          epss,
          epssPercentile: Number.isFinite(pct) ? pct : undefined,
          epssDate: row.date,
        });
      }
    }
    // EPSS is a forecast, not evidence: vulnerabilities only, no observations.
    return {
      observations: [],
      vulnerabilities,
      raw: { body: JSON.stringify({ scored: fetched }), contentType: "application/json" },
    };
  },
};
