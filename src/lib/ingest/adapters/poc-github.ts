import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { httpGet } from "../http";
import { isCveId, mapLimit, pickBatch } from "../util";

const HEAD = 40;
const ROTATING = 60;

interface PocRepo {
  full_name?: string;
  html_url?: string;
  stargazers_count?: number;
  created_at?: string;
}

export function parsePocFile(cve: string, repos: PocRepo[]): { obs?: ObservationInput; vuln?: VulnerabilityInput } {
  if (!repos.length) return {};
  const year = cve.split("-")[1];
  const top = [...repos]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 3)
    .map((r) => ({ repo: r.full_name, stars: r.stargazers_count ?? 0 }));
  const earliest = repos.map((r) => r.created_at).filter(Boolean).sort()[0];
  return {
    obs: {
      sourceId: "poc-github",
      dedupeKey: `poc-github:${cve}`,
      kind: "exploit_available",
      strength: "claimed",
      cveIds: [cve],
      title: `${repos.length} public GitHub ${repos.length === 1 ? "repository claims" : "repositories claim"} a proof of concept for ${cve}`,
      url: `https://github.com/nomi-sec/PoC-in-GitHub/blob/master/${year}/${cve}.json`,
      publishedAt: earliest,
      metadata: { maturity: "poc", repoCount: repos.length, top },
    },
    vuln: { cveId: cve, exploitMaturity: "poc" },
  };
}

export const pocGithubAdapter: SourceAdapter = {
  id: "poc-github",
  name: "PoC-in-GitHub",
  intervalMinutes: 180,
  async run(ctx): Promise<AdapterResult> {
    const tracked = (ctx.trackedCves ?? []).filter(isCveId);
    const { batch, nextOffset } = pickBatch(tracked, Number(ctx.cursor ?? 0) || 0, HEAD, ROTATING);
    const observations: ObservationInput[] = [];
    const vulnerabilities: VulnerabilityInput[] = [];
    await mapLimit(batch, 8, async (cve) => {
      const year = cve.split("-")[1];
      const res = await httpGet(ctx.fetch, `https://raw.githubusercontent.com/nomi-sec/PoC-in-GitHub/master/${year}/${cve}.json`, {
        allowStatus: [404],
        sleep: ctx.sleep,
      });
      if (!res.ok) return;
      const { obs, vuln } = parsePocFile(cve, JSON.parse(res.body));
      if (obs) observations.push(obs);
      if (vuln) vulnerabilities.push(vuln);
    });
    return {
      observations,
      vulnerabilities,
      cursor: String(nextOffset),
      raw: { body: JSON.stringify({ requested: batch.length, withPoc: observations.length }), contentType: "application/json" },
    };
  },
};
