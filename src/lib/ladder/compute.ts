import {
  EMPTY_LADDER,
  type ExploitMaturity,
  type Ladder,
  type ObservationKind,
  type ObservationStrength,
  type Rung,
  type RungState,
} from "./types";

/** The parts of an observation the ladder needs. */
export interface LadderObservation {
  sourceId: string;
  kind: ObservationKind;
  strength: ObservationStrength;
  metadata?: Record<string, unknown> | null;
}

const distinctSources = (obs: LadderObservation[]) => new Set(obs.map((o) => o.sourceId)).size;

/**
 * Observations to ladder, per the rules table in docs/architecture.md.
 *
 * - Talk: confirmed with 2+ independent talk or advisory sources, reported with 1.
 * - Exposure: confirmed from a government or vendor figure, reported when only quoted in news.
 * - Attack attempts: confirmed from 2+ independent reports (or one confirmed telemetry
 *   observation), reported with 1.
 * - Exploited: confirmed by KEV, vendor flag or CISA ADP; reported from sightings or news.
 * - Damage: confirmed by a filing, notice or breach record. Claims never move this rung.
 *
 * One entailment: confirmed or reported exploitation lifts Attack attempts to the same state,
 * because exploitation is a successful attempt. No other rung is inferred.
 */
export function computeLadder(observations: LadderObservation[]): Ladder {
  const ladder: Ladder = { ...EMPTY_LADDER };
  const by = (kinds: ObservationKind[]) => observations.filter((o) => kinds.includes(o.kind));

  const talk = by(["talk", "advisory"]).filter((o) => o.strength !== "claimed");
  ladder.talk = talk.length === 0 ? "none" : distinctSources(talk) >= 2 ? "confirmed" : "reported";

  const exposure = by(["exposure"]).filter((o) => o.strength !== "claimed");
  ladder.exposure = exposure.some((o) => o.strength === "confirmed")
    ? "confirmed"
    : exposure.length
      ? "reported"
      : "none";

  const attempts = by(["attempts"]).filter((o) => o.strength !== "claimed");
  ladder.attempts = attempts.some((o) => o.strength === "confirmed") || distinctSources(attempts) >= 2
    ? "confirmed"
    : attempts.length
      ? "reported"
      : "none";

  const exploited = by(["exploited"]).filter((o) => o.strength !== "claimed");
  ladder.exploited = exploited.some((o) => o.strength === "confirmed")
    ? "confirmed"
    : exploited.length
      ? "reported"
      : "none";

  // Exploitation is a successful attack attempt, so the attempts rung is at least as strong as
  // the exploited rung. This is the one entailment the ladder applies; nothing else is inferred.
  const rank: Record<RungState, number> = { none: 0, reported: 1, confirmed: 2 };
  if (rank[ladder.exploited] > rank[ladder.attempts]) ladder.attempts = ladder.exploited;

  const damage = by(["damage"]);
  ladder.damage = damage.some((o) => o.strength === "confirmed")
    ? "confirmed"
    : damage.some((o) => o.strength === "reported")
      ? "reported"
      : "none";

  return ladder;
}

const MATURITY_RANK: Record<ExploitMaturity, number> = { none: 0, poc: 1, weaponized: 2 };

export function maxMaturity(a: ExploitMaturity, b: ExploitMaturity): ExploitMaturity {
  return MATURITY_RANK[a] >= MATURITY_RANK[b] ? a : b;
}

export function isExploitMaturity(v: unknown): v is ExploitMaturity {
  return v === "none" || v === "poc" || v === "weaponized";
}

/** Sources whose exploit_available observations imply a maturity when metadata does not say. */
const SOURCE_MATURITY: Record<string, ExploitMaturity> = {
  metasploit: "weaponized",
  nuclei: "weaponized",
  "poc-github": "poc",
  exploitdb: "poc",
  "circl-sightings": "poc",
};

/**
 * Exploit maturity beside the ladder: none, poc (PoC-in-GitHub, Exploit-DB, CIRCL PoC sighting) or
 * weaponized (Metasploit module, nuclei template). Takes the highest signal across observations
 * and any per-CVE maturity already merged into the vulnerability rows.
 */
export function computeExploitMaturity(
  observations: LadderObservation[],
  vulnerabilityMaturities: (string | null | undefined)[] = [],
): ExploitMaturity {
  let best: ExploitMaturity = "none";
  for (const o of observations) {
    if (o.kind !== "exploit_available") continue;
    const m = o.metadata?.maturity;
    best = maxMaturity(best, isExploitMaturity(m) ? m : (SOURCE_MATURITY[o.sourceId] ?? "poc"));
  }
  for (const m of vulnerabilityMaturities) if (isExploitMaturity(m)) best = maxMaturity(best, m);
  return best;
}

/**
 * One label per reported (unconfirmed) exploitation observation: "telegram", a host name, or the
 * adapter id. Sorted, repeats kept, so the length is the number of separate reports and the
 * distinct values are the kinds of reporter. Empty when nothing reports exploitation. Feeds
 * VerdictContext.reportedExploitationSources.
 */
export function reportedExploitationSources(observations: LadderObservation[]): string[] {
  const out: string[] = [];
  for (const o of observations) {
    if (o.kind !== "exploited" || o.strength !== "reported") continue;
    const label = o.metadata?.sourceLabel;
    out.push(typeof label === "string" && label ? label : o.sourceId);
  }
  return out.sort();
}

export function ladderEquals(a: Record<string, string>, b: Record<string, string>): boolean {
  return (["talk", "exposure", "attempts", "exploited", "damage"] as Rung[]).every((r) => (a[r] ?? "none") === (b[r] ?? "none"));
}

export function highestRung(ladder: Ladder): { rung: Rung; state: RungState } | undefined {
  for (const rung of ["damage", "exploited", "attempts", "exposure", "talk"] as Rung[]) {
    if (ladder[rung] !== "none") return { rung, state: ladder[rung] };
  }
  return undefined;
}
