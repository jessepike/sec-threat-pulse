import type { ExploitMaturity, Ladder, Verdict } from "../types";

export interface VerdictContext {
  exploitMaturity: ExploitMaturity;
  /** Highest EPSS among the event's CVEs (0 to 1), if known. */
  epss?: number;
  /** True when CISA marks any CVE as used in ransomware campaigns. */
  kevRansomware?: boolean;
  vendor?: string;
  product?: string;
}

export interface VerdictResult {
  verdict: Verdict;
  /** Plain language, no em dashes. Shown to readers. */
  reason: string;
}

export interface RulesVersion {
  version: string;
  evaluate(ladder: Ladder, ctx: VerdictContext): VerdictResult;
}
