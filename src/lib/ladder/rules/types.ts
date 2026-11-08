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
  /** Days since an authoritative source first confirmed exploitation (KEV listing or SSVC active), if known. From v3. */
  daysSinceConfirmed?: number;
  /** Days since the first dated report of attacks, exploitation or damage, if known. From v3. */
  daysSinceFirstReport?: number;
  /** Category id from the fixed table in lib/ladder/category, if the caller computed it. From v3. */
  categoryId?: string;
  /** Number of canonical affected products, if known. From v3. */
  affectedProductCount?: number;
  /** True when the flaw is in a component that other products ship. From v3. */
  embedsComponent?: boolean;
}

/** Tier inside Act now. "today" is the short list the home page leads with. From v3. */
export type ActTier = "today" | "now";

export interface VerdictResult {
  verdict: Verdict;
  /** Plain language, no em dashes. Shown to readers after reasons.ts has applied any wording override. */
  reason: string;
  /** Stable id of the rule that fired, for wording overrides and audits. v0 and v1 predate this field. */
  ruleId?: string;
  /** Tier inside Act now. Only set for act_now verdicts, and only by versions from v3 on. */
  tier?: ActTier;
  /** Ranking score inside a verdict, higher first. Only by versions from v3 on. */
  score?: number;
  /** Plain reasons for the score, one per factor, in score order. */
  scoreWhy?: string[];
}

export interface RulesVersion {
  version: string;
  /** The version whose verdicts this one keeps unchanged, when it only adds a tier or a score. Its backtest report applies. */
  verdictsFrom?: string;
  evaluate(ladder: Ladder, ctx: VerdictContext): VerdictResult;
}
