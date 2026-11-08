import { RUNGS, type Ladder, type Rung } from "./types";

/**
 * Rungs no source we use can fill yet for an event of this kind. A rung with no evidence on one of
 * these reads "not tracked yet", so a reader never takes our gap for good news.
 * Remove a rung from here in the same pull request that adds a source for it.
 */
export const UNTRACKED_RUNGS: Record<string, Partial<Record<Rung, string>>> = {
  vulnerability: {
    exposure: "We have no source that counts exposed systems yet. Internet scan data needs a partnership we do not have. No evidence here does not mean nothing is exposed.",
    damage: "Breach notices and filings rarely name the flaw that was used, so we cannot link them to this event yet. No evidence here does not mean no harm.",
  },
};

/** Why a rung is not tracked for this kind of event, or null when it is tracked. */
export function untrackedNote(kind: string | null | undefined, rung: Rung): string | null {
  return UNTRACKED_RUNGS[kind ?? "vulnerability"]?.[rung] ?? null;
}

/** Rungs with no evidence that we have no source for. Evidence that did arrive always shows. */
export function untrackedRungs(kind: string | null | undefined, ladder: Ladder): Rung[] {
  return RUNGS.filter((r) => ladder[r] === "none" && untrackedNote(kind, r) !== null);
}
