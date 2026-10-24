// Historical dataset shapes for the verdict backtest. Dates are YYYY-MM-DD (UTC) unless noted.
// Every date is the day the signal became publicly available, as best the source history tells us.

import type { Verdict } from "@/lib/ladder/types";

export type Stratum = "kev" | "signal" | "random";

/** How a CIRCL "exploited" sighting was sourced. Decides which rung it feeds and whether it is independent of KEV. */
export type CirclSourceKind = "kev-catalog" | "honeypot" | "telegram" | "other";

export interface CirclSighting {
  type: "exploited" | "poc" | "confirmed";
  date: string;
  sourceKind: CirclSourceKind;
  /** Host name or feed label used to tell independent sources apart. */
  sourceId: string;
}

export interface BacktestCve {
  cveId: string;
  stratum: Stratum;
  /** CVE List V5 datePublished. Missing for a few old records. */
  published?: string;
  cvss?: number;
  vendor?: string;
  product?: string;
  kev?: { dateAdded: string; ransomware: boolean };
  vulncheckKev?: { dateAdded: string };
  /** First day the CISA ADP SSVC decision showed this value, from Vulnrichment git history. */
  ssvc?: { active?: string; poc?: string };
  /** Change points of the daily EPSS score: [date, score]. The score holds until the next point. */
  epss: [string, number][];
  /** Days Metasploit modules referencing the CVE were added. */
  metasploit: string[];
  /** Day a nuclei template for the CVE was added. */
  nuclei?: string;
  /** PoC-in-GitHub repositories: creation day and stars. */
  pocGithub: { created: string; stars: number }[];
  /** Exploit-DB entry publication days. */
  exploitdb: string[];
  circl: CirclSighting[];
}

export interface BacktestDataset {
  builtAt: string;
  /** Replay window. */
  from: string;
  to: string;
  /** Last day with complete outcome data (the build day). Calls need 30 days of follow-up before this. */
  dataEnd: string;
  /** Git history horizon: a signal dated here or earlier existed before the window. */
  historyHorizon: string;
  sampling: {
    seed: number;
    /** Population sizes, used to weight sampled strata back to the population. */
    population: Record<Stratum, number>;
    sampled: Record<Stratum, number>;
  };
  sources: Record<string, string>;
  cves: BacktestCve[];
}

export interface VerdictTransition {
  day: string;
  verdict: Verdict;
  reason: string;
}

export interface CveReplay {
  cveId: string;
  stratum: Stratum;
  /** First and last replayed day. */
  start: string;
  end: string;
  transitions: VerdictTransition[];
  /** Earliest day exploitation counts as confirmed, or undefined. */
  confirmedAt?: string;
  /** Which evidence confirmed it first. */
  confirmedBy?: "cisa-kev" | "vulncheck-kev" | "ssvc-active" | "two-reports";
  kevDate?: string;
}
