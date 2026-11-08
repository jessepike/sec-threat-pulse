import type { EventRow } from "./types";

export const TOP_SIZE = 5;

export interface TopItem {
  rank: number;
  row: EventRow;
}

/**
 * The home page's first list: up to five Act now events in rank order (verdict, tier, score,
 * newest evidence; rows arrive already sorted). Watch and Low never make it, so a quiet week
 * shows fewer than five rather than padding the list.
 */
export function topFive(rows: EventRow[]): TopItem[] {
  return rows
    .filter((r) => r.verdict === "act_now")
    .slice(0, TOP_SIZE)
    .map((row, i) => ({ rank: i + 1, row }));
}

const flaws = (n: number) => `${n} ${n === 1 ? "flaw" : "flaws"}`;

/** One plain sentence for the week, from fixed templates. No model writes it. */
export function weekLine(rows: EventRow[], top: TopItem[]): string {
  const today = rows.filter((r) => r.verdict === "act_now" && r.tier === "today").length;
  const actNow = rows.filter((r) => r.verdict === "act_now").length;
  if (!top.length) return "No flaw meets the Act now bar right now. Nothing here needs you this week.";
  const lead = `${flaws(actNow)} ${actNow === 1 ? "needs" : "need"} action now.`;
  const start = top.length === 1 ? "Start here." : "Start at the top.";
  if (today) return `${lead} ${today === actNow ? (actNow === 1 ? "It had" : "All had") : `${today} had`} attacks confirmed in the last two weeks on systems open to the internet. ${start}`;
  return `${lead} None had new attacks confirmed on internet-facing systems in the last two weeks. ${start}`;
}
