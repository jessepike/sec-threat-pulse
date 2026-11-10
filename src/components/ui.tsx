import type { ReactNode } from "react";
import { RUNGS, type Ladder, type RungState, type Verdict } from "@/lib/ladder/types";
import { RUNG_SHORT } from "@/lib/data/sample";

export const VERDICT_STYLE: Record<Verdict, { label: string; cls: string; bar: string; text: string }> = {
  act_now: { label: "▲ ACT NOW", cls: "text-crit-text bg-crit-bg border-crit", bar: "bg-crit", text: "text-crit-text" },
  watch: { label: "◆ WATCH", cls: "text-warn-text bg-warn-bg border-warn", bar: "bg-warn", text: "text-warn-text" },
  low: { label: "● LOW", cls: "text-ok-text bg-ok-bg border-ok", bar: "bg-ok", text: "text-ok-text" },
};

export function VerdictBadge({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-block whitespace-nowrap border font-mono font-bold ${v.cls} ${
        large ? "rounded-[3px] px-3 py-2 text-[15px] tracking-[0.1em]" : "rounded-sm px-[9px] py-1.5 text-xs tracking-[0.08em]"
      }`}
    >
      {v.label}
    </span>
  );
}

/** The Act today tier, shown beside an Act now badge. */
/** NEW or CHANGED in the last 7 days. Words, never colour alone. */
export function MarkBadge({ mark }: { mark?: "new" | "changed" }) {
  if (!mark) return null;
  return (
    <span
      className="inline-block whitespace-nowrap rounded-sm border border-accent px-[7px] py-[3px] font-mono text-[11px] font-bold tracking-[0.08em] text-accent"
      title={mark === "new" ? "First appeared in the last 7 days" : "Verdict or evidence ladder changed in the last 7 days"}
    >
      {mark === "new" ? "NEW" : "CHANGED"}
    </span>
  );
}

export function TierBadge({ tier, large = false }: { tier?: "today" | "now" | null; large?: boolean }) {
  if (tier !== "today") return null;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm border border-crit bg-crit font-mono font-bold text-accent-ink ${
        large ? "px-3 py-2 text-[15px] tracking-[0.1em]" : "px-[9px] py-1.5 text-xs tracking-[0.08em]"
      }`}
      title="Exploitation confirmed in the last two weeks on an internet-facing product, with ransomware use or with public attack tools"
    >
      TODAY
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-xs tracking-[0.1em] text-muted">{children}</div>;
}

export function H2({ id, children, size = "lg" }: { id?: string; children: ReactNode; size?: "lg" | "md" | "sm" }) {
  const s = size === "lg" ? "text-[28px] sm:text-4xl" : size === "md" ? "text-[26px] sm:text-[30px]" : "text-2xl sm:text-[26px]";
  return (
    <h2 id={id} className={`m-0 font-display font-bold tracking-[-0.02em] ${s}`}>
      {children}
    </h2>
  );
}

export const STATE_WORD: Record<RungState, string> = { confirmed: "confirmed", reported: "reported", none: "no evidence" };

export function ladderLabel(ladder: Ladder): string {
  return RUNGS.map((r) => `${RUNG_SHORT[r].toLowerCase()}: ${STATE_WORD[ladder[r]]}`).join(", ");
}

export function Seg({ state, large = false }: { state: RungState; large?: boolean }) {
  return <span aria-hidden="true" className={`seg seg-${state}${large ? " seg-lg" : ""}`} />;
}

/** Five-segment ladder for tables and cards. */
export function MiniLadder({ ladder, topLabel }: { ladder: Ladder; topLabel?: string }) {
  return (
    <div className="flex flex-col gap-1.5 pt-1" role="img" aria-label={`Evidence ladder. ${ladderLabel(ladder)}`}>
      <div className="flex gap-[3px]">
        {RUNGS.map((r) => (
          <Seg key={r} state={ladder[r]} />
        ))}
      </div>
      {topLabel && <div className="font-mono text-[11px] tracking-[0.06em] text-muted">{topLabel}</div>}
    </div>
  );
}

export function LadderKey() {
  return (
    <div className="flex flex-wrap gap-x-[18px] gap-y-2 font-mono text-xs tracking-[0.06em] text-muted" aria-label="Ladder key" role="group">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="seg seg-confirmed !h-2.5 !w-[22px] !flex-none" />
        CONFIRMED
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="seg seg-reported !h-2.5 !w-[22px] !flex-none" />
        REPORTED
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="seg seg-none !h-2.5 !w-[22px] !flex-none" />
        NO EVIDENCE
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded border border-line bg-surface ${className}`}>{children}</div>;
}

export function topLabel(top: string | null) {
  return top ? `HIGHEST CONFIRMED: ${top}` : "NOTHING CONFIRMED";
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}
