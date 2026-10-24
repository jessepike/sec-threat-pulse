// Plain language history of the verdict rules, for the public methodology page and /admin/rules.
// The rule code in v0.ts, v1.ts and v2.ts is frozen. Add an entry here when a new version ships.
// Numbers come from docs/methodology-rules.md and reports/backtest/.

export interface RulesChange {
  version: string;
  /** Date the version was released, YYYY-MM-DD. */
  date: string;
  /** One line a non-technical reader can follow. */
  summary: string;
  /** What the backtest found, in one or two sentences. */
  finding: string;
}

/** Newest first. */
export const RULES_CHANGELOG: RulesChange[] = [
  {
    version: "v2",
    date: "2026-10-24",
    summary: "An early Act now needs two separate exploitation reports, or one report plus attack attempts seen by honeypots.",
    finding:
      "On the tuning period this kept all 38 correct early calls of v1 and removed 150 of its 194 wrong ones. On the six held out months an early Act now was right within 30 days 35% of the time (21% to 53%), against 21.5% for v1.",
  },
  {
    version: "v1",
    date: "2026-10-24",
    summary: "Designed from the first backtest. Reported exploitation of a CVE 90 days old or newer is Act now, and confirmed exploitation gets two more reasons to be urgent.",
    finding:
      "The share of CISA KEV additions that reach Act now rose from 65% to 97%. A single early report was usually not confirmed, and v1's wording promised otherwise. v2 replaces that rule, and readers now see corrected wording for v1 results.",
  },
  {
    version: "v0",
    date: "2026-10-24",
    summary: "The first rules, written before any testing. Confirmed exploitation plus an urgency factor is Act now, and so is reported exploitation with ready-made attack tools.",
    finding: "Kept for replay. It left about a third of KEV additions at Watch, and its early calls were right 15.8% of the time over the whole window (10% to 24%).",
  },
];
