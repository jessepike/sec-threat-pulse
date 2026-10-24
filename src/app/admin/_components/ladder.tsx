import { RUNGS, RUNG_LABELS, type Ladder } from "@/lib/ladder/types";

export function LadderCells({ ladder }: { ladder: Record<string, string> }) {
  return (
    <span className="adm-ladder" aria-label="Evidence ladder">
      {RUNGS.map((r) => (
        <span
          key={r}
          className={`adm-rung adm-rung-${(ladder as Ladder)[r] ?? "none"}`}
          title={`${RUNG_LABELS[r]}: ${ladder[r] ?? "none"}`}
        />
      ))}
    </span>
  );
}
