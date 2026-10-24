import type { ExploitMaturity, Ladder, Verdict } from "../types";

export interface VerdictContext {
  exploitMaturity: ExploitMaturity;
  /** Highest EPSS among the event's CVEs (0 to 1), if known. */
  epss?: number;
  /** True when CISA marks any CVE as used in ransomware campaigns. */
  kevRansomware?: boolean;
  vendor?: string;
  product?: string;
  /** Highest CVSS base score among the event's CVEs, if known. */
  cvss?: number;
  /** Days since the CVE record was published, if known. */
  daysSincePublished?: number;
  /** Public GitHub repositories claiming a proof of concept. */
  pocRepoCount?: number;
  /**
   * One entry per reported (unconfirmed) exploitation observation, naming its source: "telegram",
   * a host name, "news". The length is the number of separate reports. Lets a rule ask for a
   * second report or for corroboration of social posts. Empty or missing when exploitation is
   * not reported.
   */
  reportedExploitationSources?: string[];
}

export interface VerdictResult {
  verdict: Verdict;
  /** Plain language, no em dashes. Shown to readers after reasons.ts has applied any wording override. */
  reason: string;
  /** Stable id of the rule that fired, for wording overrides and audits. v0 and v1 predate this field. */
  ruleId?: string;
}

export interface RulesVersion {
  version: string;
  evaluate(ladder: Ladder, ctx: VerdictContext): VerdictResult;
}
