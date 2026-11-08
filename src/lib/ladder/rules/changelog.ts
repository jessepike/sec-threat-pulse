// Plain language history of the verdict rules, for the public methodology page and /admin/rules.
// The rule code in v0.ts, v1.ts, v2.ts and v3.ts is frozen. Add an entry here when a new version ships.
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
    version: "v3",
    date: "2026-11-08",
    summary: "Verdicts are unchanged from v2. Inside Act now, an Act today tier marks flaws with exploitation confirmed in the last 14 days on an internet-facing product, with ransomware use or with public attack tools, and every event gets a 0 to 11 ranking score with one line per factor.",
    finding:
      "On Nov 7, 75 of 112 events were Act now, so the verdict alone no longer sorted attention. Replayed over every KEV addition on the tuning period, the 14 day tier held a median of 5 CVEs a day (90th percentile 8) and was empty on one day in 335. Hit rates are v2's, because the verdicts are.",
  },
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
