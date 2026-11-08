/**
 * The clock on an event: the dates practitioners rank by, assembled from source data.
 * Disclosure (the CVE record), exploit code (the first public exploit observation), the first
 * attack or exploitation report, the CISA KEV listing and its federal deadline. Every date keeps
 * the observation it came from so the page can link it. Missing dates stay missing.
 */

export interface ClockPoint {
  /** YYYY-MM-DD (UTC). */
  date: string;
  /** What set this date, for example "Metasploit module" or "CISA KEV". */
  label: string;
  url?: string;
}

export interface Clock {
  disclosed?: ClockPoint;
  exploitCode?: ClockPoint;
  firstReport?: ClockPoint;
  kevListed?: ClockPoint;
  kevDue?: ClockPoint;
  /** Days from disclosure to the first attack or exploitation report, when both are known. */
  daysToFirstReport?: number;
  /** Days from disclosure to the KEV listing, when both are known. */
  daysToKev?: number;
}

export interface ClockVuln {
  cveId: string;
  publishedAt?: Date | string | null;
  kevCisaDateAdded?: string | null;
}

export interface ClockObservation {
  sourceId: string;
  sourceName?: string | null;
  kind: string;
  strength: string;
  title: string;
  url: string;
  publishedAt?: Date | string | null;
  metadata?: Record<string, unknown> | null;
}

const DAY = 86_400_000;
const day = (d: Date | string | null | undefined): string | undefined => {
  if (!d) return undefined;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString().slice(0, 10);
};
const daysBetween = (a?: string, b?: string): number | undefined => (a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY) : undefined);

function earliest(obs: ClockObservation[], label: (o: ClockObservation) => string): ClockPoint | undefined {
  const dated = obs.map((o) => ({ o, d: day(o.publishedAt) })).filter((x): x is { o: ClockObservation; d: string } => !!x.d).sort((a, b) => a.d.localeCompare(b.d));
  const first = dated[0];
  return first ? { date: first.d, label: label(first.o), url: first.o.url } : undefined;
}

export function computeClock(vulns: ClockVuln[], obs: ClockObservation[]): Clock {
  const clock: Clock = {};
  const disclosedDates = vulns.map((v) => day(v.publishedAt)).filter((d): d is string => !!d).sort();
  if (disclosedDates.length) {
    const cve = vulns.find((v) => day(v.publishedAt) === disclosedDates[0])?.cveId;
    clock.disclosed = { date: disclosedDates[0], label: cve ? `${cve} published` : "CVE published", url: cve ? `https://www.cve.org/CVERecord?id=${cve}` : undefined };
  }
  clock.exploitCode = earliest(
    obs.filter((o) => o.kind === "exploit_available" && o.strength !== "claimed"),
    (o) => o.sourceName ?? o.sourceId,
  );
  clock.firstReport = earliest(
    obs.filter((o) => (o.kind === "attempts" || o.kind === "exploited" || o.kind === "damage") && o.strength !== "claimed"),
    (o) => o.sourceName ?? o.sourceId,
  );
  const kevDates = vulns.map((v) => v.kevCisaDateAdded?.slice(0, 10)).filter((d): d is string => !!d).sort();
  const kevObs = obs.filter((o) => o.sourceId === "cisa-kev");
  if (kevDates.length) {
    clock.kevListed = { date: kevDates[0], label: "CISA KEV listing", url: kevObs[0]?.url ?? "https://www.cisa.gov/known-exploited-vulnerabilities-catalog" };
  } else if (kevObs.length) {
    clock.kevListed = earliest(kevObs, () => "CISA KEV listing");
  }
  const due = kevObs
    .map((o) => (o.metadata as { dueDate?: unknown } | null)?.dueDate)
    .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()[0];
  if (due) clock.kevDue = { date: due, label: "CISA deadline for US federal agencies", url: kevObs[0]?.url };
  clock.daysToFirstReport = daysBetween(clock.disclosed?.date, clock.firstReport?.date);
  clock.daysToKev = daysBetween(clock.disclosed?.date, clock.kevListed?.date);
  return clock;
}

/** Distinct sources behind each rung's evidence, counting the entailment the ladder applies. */
export function sourceCounts(obs: { kind: string; strength: string; sourceId: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rung of ["talk", "exposure", "attempts", "exploited", "damage"]) {
    const kinds = rung === "talk" ? ["talk", "advisory"] : [rung];
    const mine = obs.filter((o) => kinds.includes(o.kind) && o.strength !== "claimed");
    out[rung] = new Set(mine.map((o) => o.sourceId)).size;
  }
  if (out.attempts < out.exploited) out.attempts = out.exploited;
  return out;
}
