import Link from "next/link";
import type { EventRow } from "@/lib/data/types";
import { RUNG_SHORT } from "@/lib/data/sample";
import { fmtDayYear } from "@/lib/data/format";
import { MarkBadge, MiniLadder, TierBadge, VerdictBadge } from "./ui";

/**
 * The one event row every list uses: /events, vendor pages and anything that lists events.
 * One markup for phone and desktop. The whole row is the link. Category sentences ("what it is",
 * "do this") stay on the event page, so a list never repeats one sentence down the page.
 */
export function EventList({ events, label, empty = "No events are tracked yet." }: { events: EventRow[]; label: string; empty?: string }) {
  if (events.length === 0) return <p className="m-0 rounded border border-line bg-surface px-5 py-6 text-[15px] text-muted">{empty}</p>;
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col rounded border border-line bg-surface p-0">
      {events.map((e) => (
        <li
          key={e.id}
          className="relative grid min-w-0 gap-x-6 gap-y-3 border-b border-line-soft px-5 py-4 last:border-b-0 hover:bg-surface-2 md:grid-cols-[150px_minmax(0,1fr)_190px] md:items-center md:px-6 [overflow-wrap:anywhere]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={e.verdict} />
            <TierBadge tier={e.tier} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Link href={e.href} className="font-display text-lg font-semibold leading-snug text-fg no-underline after:absolute after:inset-0 after:content-[''] hover:text-accent">
                {e.title}
              </Link>
              <MarkBadge mark={e.mark} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs tracking-[0.04em] text-muted">
              {e.category && <span>{e.category.label.toUpperCase()}</span>}
              {e.lastSignal && <span>LAST ATTACK REPORT {fmtDayYear(e.lastSignal)}</span>}
              {e.idsLabel && <span className="text-faint">{e.idsLabel}</span>}
            </div>
          </div>
          <MiniLadder ladder={e.ladder} topLabel={e.topConfirmed ? `CONFIRMED: ${RUNG_SHORT[e.topConfirmed]}` : "NOTHING CONFIRMED"} />
        </li>
      ))}
    </ul>
  );
}
