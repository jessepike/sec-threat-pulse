import type { AdapterResult, ObservationInput, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { httpGet } from "../http";
import { cursorEtag, extractCves, fileCursorUnchanged, isoOrUndefined, packFileCursor, sortCvesNewest } from "../util";

export const METASPLOIT_URL =
  "https://raw.githubusercontent.com/rapid7/metasploit-framework/master/db/modules_metadata_base.json";
const RECENT_CAP = 100;

interface MsfModule {
  name?: string;
  fullname?: string;
  type?: string;
  references?: string[];
  disclosure_date?: string | null;
  mod_time?: string;
  path?: string;
}

export function parseMetasploit(
  modules: Record<string, MsfModule>,
  tracked: Set<string>,
  recentCap = RECENT_CAP,
): { observations: ObservationInput[]; vulnerabilities: VulnerabilityInput[] } {
  const candidates: { m: MsfModule; cves: string[] }[] = [];
  for (const m of Object.values(modules)) {
    if (m.type !== "exploit" || !m.fullname) continue;
    const cves = extractCves(m.references);
    if (cves.length) candidates.push({ m, cves });
  }
  // Tracked CVEs always. Plus the newest modules by CVE id, capped.
  const newestCves = new Set(sortCvesNewest([...new Set(candidates.flatMap((c) => c.cves))]).slice(0, recentCap));
  const observations: ObservationInput[] = [];
  const vulnMap = new Map<string, VulnerabilityInput>();
  for (const { m, cves } of candidates) {
    if (!cves.some((c) => tracked.has(c) || newestCves.has(c))) continue;
    const gitPath = (m.path ?? `/modules/${m.fullname}.rb`).replace(/^\//, "");
    observations.push({
      sourceId: "metasploit",
      dedupeKey: `metasploit:${m.fullname}`,
      kind: "exploit_available",
      strength: "confirmed",
      cveIds: cves,
      title: `Metasploit exploit module: ${m.name ?? m.fullname}`,
      url: `https://github.com/rapid7/metasploit-framework/blob/master/${gitPath}`,
      publishedAt: isoOrUndefined(m.disclosure_date ?? undefined) ?? isoOrUndefined(m.mod_time),
      metadata: { maturity: "weaponized", module: m.fullname },
    });
    for (const c of cves) vulnMap.set(c, { cveId: c, exploitMaturity: "weaponized" });
  }
  return { observations, vulnerabilities: [...vulnMap.values()] };
}

export const metasploitAdapter: SourceAdapter = {
  id: "metasploit",
  name: "Metasploit module metadata",
  intervalMinutes: 360,
  async run(ctx): Promise<AdapterResult> {
    const tracked = ctx.trackedCves ?? [];
    const res = await httpGet(ctx.fetch, METASPLOIT_URL, { etag: cursorEtag(ctx.cursor), timeoutMs: 90000, sleep: ctx.sleep });
    // Same file and same tracked set as last time: nothing to do.
    if (res.notModified || fileCursorUnchanged(ctx.cursor, res.etag, tracked)) {
      return { observations: [], vulnerabilities: [], cursor: ctx.cursor };
    }
    const parsed = parseMetasploit(JSON.parse(res.body), new Set(tracked));
    return { ...parsed, raw: { body: res.body, contentType: "application/json" }, cursor: packFileCursor(res.etag, tracked) };
  },
};
