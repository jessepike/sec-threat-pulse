import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { httpGet } from "../http";
import { cursorEtag, fileCursorUnchanged, isCveId, packFileCursor, sortCvesNewest } from "../util";

export const NUCLEI_URL =
  "https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/main/cves.json";
const RECENT_CAP = 100;

interface NucleiRow {
  ID?: string;
  Info?: { Name?: string; Severity?: string; Classification?: { CVSSScore?: string } };
  file_path?: string;
}

export function parseNuclei(
  text: string,
  tracked: Set<string>,
  recentCap = RECENT_CAP,
): { observations: ObservationInput[]; vulnerabilities: VulnerabilityInput[] } {
  const rows: NucleiRow[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as NucleiRow;
      if (r.ID && isCveId(r.ID)) rows.push(r);
    } catch {
      // skip a bad line
    }
  }
  const newest = new Set(sortCvesNewest(rows.map((r) => r.ID!.toUpperCase())).slice(0, recentCap));
  const observations: ObservationInput[] = [];
  const vulnerabilities: VulnerabilityInput[] = [];
  for (const r of rows) {
    const cve = r.ID!.toUpperCase();
    if (!tracked.has(cve) && !newest.has(cve)) continue;
    observations.push({
      sourceId: "nuclei",
      dedupeKey: `nuclei:${cve}`,
      kind: "exploit_available",
      strength: "confirmed",
      cveIds: [cve],
      title: `Nuclei scan template: ${r.Info?.Name ?? cve}`,
      url: `https://github.com/projectdiscovery/nuclei-templates/blob/main/${r.file_path ?? `http/cves/${cve}.yaml`}`,
      metadata: { maturity: "weaponized", severity: r.Info?.Severity },
    });
    vulnerabilities.push({ cveId: cve, exploitMaturity: "weaponized" });
  }
  return { observations, vulnerabilities };
}

export const nucleiAdapter: SourceAdapter = {
  id: "nuclei",
  name: "nuclei-templates",
  intervalMinutes: 360,
  async run(ctx): Promise<AdapterResult> {
    const tracked = ctx.trackedCves ?? [];
    const res = await httpGet(ctx.fetch, NUCLEI_URL, { etag: cursorEtag(ctx.cursor), timeoutMs: 60000, sleep: ctx.sleep });
    if (res.notModified || fileCursorUnchanged(ctx.cursor, res.etag, tracked)) {
      return { observations: [], vulnerabilities: [], cursor: ctx.cursor };
    }
    const parsed = parseNuclei(res.body, new Set(tracked));
    return { ...parsed, raw: { body: res.body, contentType: "application/x-ndjson" }, cursor: packFileCursor(res.etag, tracked) };
  },
};
