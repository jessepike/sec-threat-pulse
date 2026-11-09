import { RUNGS, RUNG_LABELS, type Ladder } from "@/lib/ladder/types";

const WORD = { confirmed: "confirmed", reported: "reported", none: "no evidence" } as const;

/** The same five segments readers see: solid is confirmed, hatched is reported, outlined is no evidence. */
export function LadderCells({ ladder }: { ladder: Record<string, string> }) {
  const state = (r: (typeof RUNGS)[number]) => ((ladder as Ladder)[r] ?? "none") as keyof typeof WORD;
  return (
    <span className="adm-ladder" role="img" aria-label={`Evidence ladder. ${RUNGS.map((r) => `${RUNG_LABELS[r]}: ${WORD[state(r)]}`).join(", ")}`}>
      {RUNGS.map((r) => (
        <span key={r} aria-hidden="true" className={`adm-rung adm-rung-${state(r)}`} title={`${RUNG_LABELS[r]}: ${WORD[state(r)]}`} />
      ))}
    </span>
  );
}
