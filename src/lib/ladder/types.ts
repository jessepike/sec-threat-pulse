// Shared vocabulary for the evidence ladder. Every module imports from here.

export const RUNGS = ["talk", "exposure", "attempts", "exploited", "damage"] as const;
export type Rung = (typeof RUNGS)[number];

export const RUNG_LABELS: Record<Rung, string> = {
  talk: "Talk",
  exposure: "Exposure",
  attempts: "Attack attempts",
  exploited: "Confirmed exploitation",
  damage: "Confirmed damage",
};

/** State of one rung. "reported" = credible but not yet confirmed. */
export type RungState = "confirmed" | "reported" | "none";

export type Ladder = Record<Rung, RungState>;

export const EMPTY_LADDER: Ladder = {
  talk: "none",
  exposure: "none",
  attempts: "none",
  exploited: "none",
  damage: "none",
};

/**
 * What an observation says. `rung` evidence moves the ladder. Other kinds add context:
 * exploit_available (PoC or weaponized code exists), forecast (EPSS), advisory (vendor or
 * government notice), claim (unverified, e.g. a leak-site victim claim; never confirms damage).
 */
export type ObservationKind =
  | "talk"
  | "exposure"
  | "attempts"
  | "exploited"
  | "damage"
  | "exploit_available"
  | "forecast"
  | "advisory"
  | "claim";

/** How strong this single observation is. */
export type ObservationStrength = "confirmed" | "reported" | "claimed" | "quoted";

export type ExploitMaturity = "none" | "poc" | "weaponized";

export const VERDICTS = ["act_now", "watch", "low"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  act_now: "Act now",
  watch: "Watch",
  low: "Low",
};

/** Normalized output of every ingest adapter. */
export interface ObservationInput {
  sourceId: string;
  /** Stable across re-runs, e.g. `cisa-kev:CVE-2026-0322`. Unique in the database. */
  dedupeKey: string;
  kind: ObservationKind;
  strength: ObservationStrength;
  cveIds: string[];
  vendor?: string;
  product?: string;
  /** Organization named in a damage or claim observation. */
  orgName?: string;
  title: string;
  summary?: string;
  url: string;
  /** When the source says it happened or was published (ISO). */
  publishedAt?: string;
  /** Extra source-specific fields, kept for audits. */
  metadata?: Record<string, unknown>;
}

/** Vulnerability facts an adapter can contribute (merged by CVE). */
export interface VulnerabilityInput {
  cveId: string;
  title?: string;
  description?: string;
  vendor?: string;
  product?: string;
  cvssScore?: number;
  cwe?: string[];
  publishedAt?: string;
  epss?: number;
  epssPercentile?: number;
  epssDate?: string;
  kevCisaDateAdded?: string;
  kevCisaRansomware?: boolean;
  kevVulncheckDateAdded?: string;
  exploitMaturity?: ExploitMaturity;
}

export interface AdapterResult {
  observations: ObservationInput[];
  vulnerabilities: VulnerabilityInput[];
  /** Raw payload bytes for archiving (hash is always stored; bytes go to R2 when configured). */
  raw?: { body: string; contentType: string };
  /** Opaque cursor stored on the source for the next incremental run. */
  cursor?: string;
  /** Set when the adapter chose not to run (for example a missing API token). Not an error. */
  skipped?: string;
}

export interface SourceAdapter {
  id: string;
  name: string;
  /** Default poll interval in minutes. */
  intervalMinutes: number;
  run(ctx: AdapterContext): Promise<AdapterResult>;
}

/** Everything an adapter receives. Only cursor, fetch and now are required. */
export interface AdapterContext {
  cursor?: string;
  fetch: typeof fetch;
  now: Date;
  /** CVE ids we track (KEV members), newest first. Used by epss, cvelist, poc-github and others. */
  trackedCves?: string[];
  /** Tracked CVEs still missing CVSS or description. Used by nvd for targeted lookups. */
  enrichCves?: string[];
  /** Environment variables adapters may read (tokens). Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Injectable delay, so tests do not wait on rate limits. */
  sleep?: (ms: number) => Promise<void>;
}
