import type { AdapterResult, ObservationInput, ObservationKind, ObservationStrength, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import { defaultSleep, getJson } from "../http";
import { isoOrUndefined, isCveId, truncate } from "../util";

const BASE = "https://vulnerability.circl.lu/api/sighting/";
const TYPES = ["exploited", "published-proof-of-concept", "confirmed", "seen"] as const;
type SightingType = (typeof TYPES)[number];
const PER_PAGE = 100;
const MAX_PAGES = 2;
// CIRCL allows 20 requests per minute.
const GAP_MS = 3200;

interface Sighting {
  uuid: string;
  type: string;
  source?: string;
  vulnerability?: string;
  creation_timestamp?: string;
}

export type CirclSourceKind = "kev-catalog" | "honeypot" | "telegram" | "other";

/**
 * Where a CIRCL sighting came from. Shadowserver honeypot feeds are telemetry (attack attempts).
 * Entries that mirror a KEV catalog repeat what the catalogs already tell us. Telegram posts and
 * other links are reports. The id tells independent sources apart (host name or feed label).
 */
export function classifyCirclSource(source?: string | null): { kind: CirclSourceKind; id: string } {
  const s = (source ?? "").trim();
  if (/shadowserver/i.test(s)) return { kind: "honeypot", id: "shadowserver" };
  if (/known-exploited-vulnerabilities-catalog/i.test(s)) return { kind: "kev-catalog", id: "circl-kev-catalog" };
  if (/^telegram\//i.test(s) || /^https?:\/\/t\.me\//i.test(s)) return { kind: "telegram", id: "telegram" };
  const host = s.match(/^https?:\/\/([^/]+)/)?.[1]?.toLowerCase();
  return { kind: "other", id: host ?? (s ? s.slice(0, 40).toLowerCase() : "unknown") };
}

/** The ladder meaning of one sighting. Shared by the live adapter and the backtest replay. */
export type CirclSightingType = "exploited" | "poc" | "confirmed" | "seen";
export interface CirclRung {
  kind: ObservationKind;
  strength: ObservationStrength;
  metadata: Record<string, unknown>;
  maturity?: "poc";
}

/**
 * One mapping for both the live adapter and the backtest, so the two cannot drift.
 *
 * - exploited from a honeypot feed: confirmed attack attempt (telemetry).
 * - exploited from a KEV catalog mirror: dropped. CIRCL imports whole catalogs in bulk, so these
 *   entries repeat what the KEV adapters already say and carry no independent evidence.
 * - exploited from Telegram or any other link: reported exploitation.
 * - published-proof-of-concept and confirmed: proof of concept exists (exploit_available, poc).
 *   "confirmed" is often a scanner template or a social post, so it stays below exploitation.
 * - seen: talk.
 */
export function circlRung(type: CirclSightingType, sourceKind: CirclSourceKind, sourceLabel?: string): CirclRung | undefined {
  switch (type) {
    case "exploited":
      if (sourceKind === "honeypot") return { kind: "attempts", strength: "confirmed", metadata: { sourceKind, telemetry: true } };
      if (sourceKind === "kev-catalog") return undefined;
      // sourceLabel ("telegram" or a host name) lets the rules tell independent reporters apart.
      return { kind: "exploited", strength: "reported", metadata: { sourceKind, sourceLabel: sourceLabel ?? sourceKind } };
    case "poc":
    case "confirmed":
      return { kind: "exploit_available", strength: "reported", metadata: { maturity: "poc" }, maturity: "poc" };
    case "seen":
      return { kind: "talk", strength: "reported", metadata: {} };
    default:
      return undefined;
  }
}

const API_TYPE: Record<SightingType, CirclSightingType> = { exploited: "exploited", "published-proof-of-concept": "poc", confirmed: "confirmed", seen: "seen" };

function mapSighting(s: Sighting): { obs: ObservationInput; maturity?: "poc" } | undefined {
  const cve = s.vulnerability?.toUpperCase();
  if (!cve || !isCveId(cve) || !s.uuid) return undefined;
  const type = API_TYPE[s.type as SightingType];
  if (!type) return undefined;
  const src = classifyCirclSource(s.source);
  const rung = circlRung(type, src.kind, src.id);
  if (!rung) return undefined;
  const link = s.source && /^https?:\/\//.test(s.source) ? s.source : `https://vulnerability.circl.lu/vuln/${cve}`;
  const publishedAt = isoOrUndefined(s.creation_timestamp);
  // Sighting text is not stored. We keep type, link and time only.
  const base = { sourceId: "circl-sightings", dedupeKey: `circl:${s.uuid}`, cveIds: [cve], url: link, publishedAt, kind: rung.kind, strength: rung.strength, metadata: { sightingType: s.type, ...rung.metadata } };
  const title =
    rung.kind === "attempts"
      ? `Attack attempts on ${cve} seen by honeypots (Shadowserver via CIRCL)`
      : rung.kind === "exploited"
        ? `Exploitation of ${cve} reported (CIRCL sighting)`
        : type === "poc"
          ? `Public proof of concept for ${cve} (CIRCL sighting)`
          : type === "confirmed"
            ? `Vulnerability ${cve} confirmed by a researcher (CIRCL sighting)`
            : truncate(`${cve} discussed publicly (CIRCL sighting)`, 120);
  return { obs: { ...base, title }, maturity: rung.maturity };
}

export const circlSightingsAdapter: SourceAdapter = {
  id: "circl-sightings",
  name: "CIRCL Vulnerability-Lookup sightings",
  intervalMinutes: 60,
  async run(ctx): Promise<AdapterResult> {
    const sleep = ctx.sleep ?? defaultSleep;
    const tracked = ctx.trackedCves?.length ? new Set(ctx.trackedCves) : undefined;
    let cursors: Partial<Record<SightingType, string>> = {};
    try {
      cursors = ctx.cursor ? JSON.parse(ctx.cursor) : {};
    } catch {
      cursors = {};
    }
    const next: Partial<Record<SightingType, string>> = { ...cursors };
    const observations: ObservationInput[] = [];
    const vulnMap = new Map<string, VulnerabilityInput>();
    let requests = 0;
    let seenTotal = 0;

    for (const type of TYPES) {
      const since = cursors[type];
      let newest = since;
      for (let page = 1; page <= MAX_PAGES; page++) {
        if (requests++ > 0) await sleep(GAP_MS);
        const { data } = await getJson<{ data?: Sighting[] }>(
          ctx.fetch,
          `${BASE}?type=${type}&per_page=${PER_PAGE}&page=${page}`,
          { sleep: ctx.sleep },
        );
        const list = data.data ?? [];
        let reachedOld = false;
        for (const s of list) {
          seenTotal++;
          const ts = s.creation_timestamp;
          if (ts && (!newest || ts > newest)) newest = ts;
          if (since && ts && ts <= since) {
            reachedOld = true;
            continue;
          }
          const mapped = mapSighting(s);
          if (!mapped) continue;
          const cve = mapped.obs.cveIds[0];
          // Only exploited sightings are kept for CVEs we do not track. The rest would be noise.
          if (tracked && type !== "exploited" && !tracked.has(cve)) continue;
          observations.push(mapped.obs);
          if (mapped.maturity) vulnMap.set(cve, { cveId: cve, exploitMaturity: "poc" });
        }
        if (reachedOld || list.length < PER_PAGE) break;
      }
      if (newest) next[type] = newest;
    }

    return {
      observations,
      vulnerabilities: [...vulnMap.values()],
      cursor: JSON.stringify(next),
      raw: { body: JSON.stringify({ sightingsRead: seenTotal, kept: observations.length }), contentType: "application/json" },
    };
  },
};
