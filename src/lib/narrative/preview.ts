import type { EventView } from "@/lib/data/types";
import { questionLines } from "./model";
import type { NarrativeRecord } from "./store";

const ROLE_LABELS = [["CISO", "ciso"], ["CIO", "cio"], ["CEO", "ceo"], ["BOARD", "board"]] as const;

/**
 * The public event view with a saved write-up laid over it, published or not. The admin preview
 * uses it to show a draft the way readers will see it. Fields the write-up leaves empty keep what
 * the public page shows today, the same fallbacks `dbEvent` applies. Claims from leak sites stay.
 */
export function withNarrative(view: EventView, n: Pick<NarrativeRecord, "businessExposure" | "whyAct" | "fix" | "askYourTeam" | "roles" | "claimChecks" | "source">, published: Pick<NarrativeRecord, "claimChecks"> | null): EventView {
  const text = (s: string | null | undefined) => s?.trim() || undefined;
  const questions = questionLines(n.askYourTeam);
  // The public view already carries the published claim checks; drop them before adding the saved ones.
  const publishedClaims = new Set((published?.claimChecks ?? []).map((c) => c.claim));
  const otherClaims = view.claims.filter((c) => !publishedClaims.has(c.claim));
  return {
    ...view,
    businessTerms: text(n.businessExposure) ?? view.businessTerms,
    whyAct: text(n.whyAct),
    fix: text(n.fix) ?? view.fix,
    askYourTeam: questions.length ? questions : view.askYourTeam,
    roles: ROLE_LABELS.map(([role, k]) => ({ role, items: n.roles[k] ?? [] })).filter((r) => r.items.length > 0),
    claims: [...n.claimChecks, ...otherClaims],
    aiDrafted: n.source === "ai_draft",
  };
}
