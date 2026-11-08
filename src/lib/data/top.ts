import type { ActTier } from "@/lib/ladder/rules";
import type { Verdict } from "@/lib/ladder/types";
import type { EventRow } from "./types";

type Ranked = { verdict: Verdict; tier?: ActTier | null };

export const TOP_SIZE = 5;

export interface TopItem<T = EventRow> {
  rank: number;
  row: T;
}

/**
 * The home page's first list: up to five Act now events in rank order (verdict, tier, score,
 * newest evidence; rows arrive already sorted). Watch and Low never make it, so a quiet week
 * shows fewer than five rather than padding the list.
 */
export function topFive<T extends Ranked>(rows: T[]): TopItem<T>[] {
  return rows
    .filter((r) => r.verdict === "act_now")
    .slice(0, TOP_SIZE)
    .map((row, i) => ({ rank: i + 1, row }));
}

const flaws = (n: number) => `${n} ${n === 1 ? "flaw" : "flaws"}`;

/** What puts an Act now flaw in the Act today group (rules v3: confirmed in 14 days, and internet-facing, ransomware or attack tools). */
const TODAY_WHY = "exploitation confirmed in the last two weeks, plus a sign of wide use";

/**
 * One plain sentence for the week, from fixed templates. No model writes it.
 * `rows` are the recent rows the list ranks (Act now with an attack report in the last 30 days);
 * `allActNow` counts every Act now event, so a quiet month is not read as "nothing needs action".
 */
export function weekLine(rows: Ranked[], top: unknown[], allActNow: number): string {
  const today = rows.filter((r) => r.verdict === "act_now" && r.tier === "today").length;
  const actNow = rows.filter((r) => r.verdict === "act_now").length;
  if (!top.length) {
    if (allActNow > 0) return `No Act now flaw has a new attack report in the last 30 days. The ${allActNow} older ${allActNow === 1 ? "one is" : "ones are"} on the events list.`;
    return "No flaw meets the Act now bar right now. Nothing here needs you this week.";
  }
  const lead = `${flaws(actNow)} under attack in the last 30 days ${actNow === 1 ? "needs" : "need"} action now.`;
  const start = top.length === 1 ? "Start here." : "Start at the top.";
  if (today) return `${lead} ${today === actNow ? (actNow === 1 ? "It is" : "All are") : `${today} ${today === 1 ? "is" : "are"}`} marked TODAY: ${TODAY_WHY}. ${start}`;
  return `${lead} None is marked TODAY this week. ${start}`;
}
