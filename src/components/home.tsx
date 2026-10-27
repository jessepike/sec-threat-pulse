import Link from "next/link";
import type { ReactNode } from "react";
import type { DriverBar, EventRow, HomeData, KpiView } from "@/lib/data/types";
import { RUNG_SHORT } from "@/lib/data/sample";
import { Eyebrow, H2, LadderKey, MiniLadder, Panel, VERDICT_STYLE, VerdictBadge, topLabel } from "./ui";
import { YourVendors } from "./YourVendors";

const GRID = "grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))]";

export function Hero({ data }: { data: HomeData }) {
  const { hero, counts } = data;
  const rows: { v: "act_now" | "watch" | "low" }[] = [{ v: "act_now" }, { v: "watch" }, { v: "low" }];
  return (
    <section aria-labelledby="hero" className="flex flex-wrap items-stretch gap-8">
      <div className="hero-card flex min-w-0 flex-[999_1_min(100%,620px)] flex-col gap-[18px] rounded border border-l-[6px] border-line border-l-crit p-6 sm:p-9">
        <Eyebrow>{`// BOTTOM LINE · WEEK OF ${data.weekOf.toUpperCase()}`}</Eyebrow>
        {hero ? (
          <>
            <div className="flex flex-wrap items-center gap-3.5">
              <VerdictBadge verdict={hero.verdict} large />
              <span className="font-mono text-[13px] text-muted">{hero.idsLabel}</span>
            </div>
            <h1 id="hero" className="m-0 font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[60px]">
              {hero.title}
            </h1>
            <p className="m-0 max-w-[640px] text-[17px] leading-[1.55] text-fg-2 sm:text-[19px]">{hero.blurb}</p>
            <div className="flex flex-wrap gap-3 pt-1.5">
              <Link href={hero.href} className="rounded-[3px] bg-accent px-5 py-3.5 font-mono text-sm font-bold tracking-[0.06em] text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink">
                WHAT TO DO →
              </Link>
              <Link href="#events" className="rounded-[3px] border border-line-strong px-5 py-[13px] font-mono text-sm tracking-[0.06em] text-fg no-underline hover:text-fg">
                ALL EVENTS
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 id="hero" className="m-0 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
              No events yet
            </h1>
            <p className="m-0 max-w-[640px] text-[17px] leading-[1.55] text-fg-2">
              The pipeline has not grouped any reports into events. Check back after the next run.
            </p>
          </>
        )}
      </div>

      <Panel className="flex flex-[1_1_280px] flex-col gap-[18px] p-7">
        <Eyebrow>{`// TRACKED EVENTS · ${counts.total}`}</Eyebrow>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map(({ v }) => {
            const s = VERDICT_STYLE[v];
            const n = counts[v];
            return (
              <li key={v} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between font-mono">
                  <span className={`text-sm tracking-[0.08em] ${s.text}`}>{s.label}</span>
                  <span className="text-[40px] font-bold">{n}</span>
                </div>
                <div className="h-1.5 bg-line-soft" role="presentation">
                  <div className={`h-1.5 ${s.bar}`} style={{ width: `${counts.total ? (n / counts.total) * 100 : 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="m-0 mt-auto text-sm leading-normal text-muted">{data.countsNote}</p>
      </Panel>
    </section>
  );
}

const DELTA_TONE = { crit: "text-crit-text", ok: "text-ok-text", muted: "text-muted" } as const;

export function KpiStrip({ kpis }: { kpis: KpiView[] }) {
  return (
    <section aria-label="Key numbers" className={`grid border-y border-line ${GRID}`}>
      {kpis.map((k) => (
        <div key={k.label} className="flex flex-col gap-2.5 border-r border-line-soft px-6 py-[26px] last:border-r-0">
          <div className="font-mono text-xs tracking-[0.08em] text-muted">{k.label}</div>
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="font-mono text-5xl font-bold leading-none tracking-[-0.02em] tabular-nums">{k.value}</div>
            <div className={`font-mono text-[13px] ${DELTA_TONE[k.deltaTone]}`}>{k.delta}</div>
          </div>
          <div className="text-sm leading-normal text-fg-2">{k.meaning}</div>
          <SourceTag source={k.source} url={k.sourceUrl} asOf={k.asOf} className="mt-auto" />
        </div>
      ))}
    </section>
  );
}

export function RealNoiseDo({ data }: { data: HomeData }) {
  return (
    <section aria-labelledby="rn" className="flex flex-col gap-5">
      <Eyebrow>{"// SIGNAL VS NOISE"}</Eyebrow>
      <H2 id="rn">{"What's real, what's noise, what to do"}</H2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] rounded border border-line bg-surface">
        <div className="flex flex-col gap-5 border-b border-line p-6 sm:p-7 lg:border-b-0 lg:border-r">
          <h3 className="m-0 font-mono text-sm font-bold tracking-[0.12em] text-crit-text">▲ REAL</h3>
          {data.real.length === 0 && <p className="m-0 text-[15px] text-muted">No confirmed events yet.</p>}
          {data.real.map((r, i) => (
            <div key={r.title} className="flex gap-3.5">
              <div className="pt-[3px] font-mono text-[13px] text-crit-text">{String(i + 1).padStart(2, "0")}</div>
              <div className="flex flex-col gap-1">
                <div className="text-[17px] font-semibold">{r.title}</div>
                <div className="text-[15px] leading-normal text-muted">{r.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 border-b border-line p-6 sm:p-7 lg:border-b-0 lg:border-r">
          <h3 className="m-0 font-mono text-sm font-bold tracking-[0.12em] text-muted">✕ NOISE</h3>
          {data.noise.map((n) => (
            <div key={n.title} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[17px] font-semibold text-muted line-through decoration-faint">{n.title}</span>
                <span className="rounded-sm border border-line-strong px-1.5 py-[3px] font-mono text-[11px] tracking-[0.1em] text-muted">{n.tag}</span>
              </div>
              <div className="text-[15px] leading-normal text-fg-2">{n.text}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 bg-surface-2 p-6 sm:p-7">
          <h3 className="m-0 font-mono text-sm font-bold tracking-[0.12em] text-accent">→ DO THIS WEEK</h3>
          {data.actions.map((a, i) => (
            <div key={a.lead} className="flex gap-4">
              <div className="font-mono text-[28px] font-bold leading-none text-accent">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-[15px] leading-normal text-fg-2">
                <strong className="text-fg">{a.lead}</strong> {a.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventTitleCell({ e }: { e: EventRow }) {
  return (
    <th scope="row" className="px-6 py-5 text-left align-top font-normal">
      <div className="flex flex-col gap-1.5">
        <Link href={e.href} className="font-display text-lg font-semibold text-fg no-underline hover:text-accent">
          {e.title}
        </Link>
        <span className="font-mono text-xs text-faint">{e.idsLabel}</span>
      </div>
    </th>
  );
}

/** The events table alone, with no heading. Used on the home page and the /events index. */
export function EventsGrid({ events, label, empty = "No events are tracked yet." }: { events: EventRow[]; label: string; empty?: string }) {
  const head = "px-6 py-3.5 text-left font-mono text-xs font-normal tracking-[0.08em] text-muted";
  return (
    <>
      <EventCards events={events} label={label} empty={empty} />
      <div className="hidden overflow-x-auto rounded border border-line bg-surface md:block" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full min-w-[1040px] border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={`${head} w-[19%]`}>EVENT</th>
            <th scope="col" className={`${head} w-[21%]`}>WHAT IT IS</th>
            <th scope="col" className={`${head} w-[19%]`}>TALK · EXPOSED · TRIED · EXPLOITED · DAMAGE</th>
            <th scope="col" className={`${head} w-[10%]`}>VERDICT</th>
            <th scope="col" className={`${head} w-[21%]`}>DO THIS</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-[15px] text-muted">{empty}</td>
            </tr>
          )}
          {events.map((e) => (
            <tr key={e.id} className="border-b border-line-soft last:border-b-0">
              <EventTitleCell e={e} />
              <td className="px-6 py-5 align-top text-[15px] leading-normal text-fg-2">
                {e.category && <span className="mb-1.5 block font-mono text-xs tracking-[0.06em] text-muted">{e.category.label.toUpperCase()}</span>}
                {e.exposure}
              </td>
              <td className="px-6 py-5 align-top">
                <MiniLadder ladder={e.ladder} topLabel={topLabel(e.topConfirmed ? RUNG_SHORT[e.topConfirmed] : null)} />
              </td>
              <td className="px-6 py-5 align-top">
                <VerdictBadge verdict={e.verdict} />
              </td>
              <td className="px-6 py-5 align-top text-[15px] leading-normal text-fg-2">
                {e.category?.doThis ?? e.question ?? <span className="text-muted">Not written yet.</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

/** Phone layout: one card per event, same facts as the table, no sideways scrolling. */
function EventCards({ events, label, empty }: { events: EventRow[]; label: string; empty: string }) {
  if (events.length === 0) return <p className="m-0 rounded border border-line bg-surface px-5 py-6 text-[15px] text-muted md:hidden">{empty}</p>;
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
      {events.map((e) => (
        <li key={e.id} className="flex min-w-0 flex-col gap-3 rounded border border-line bg-surface p-5 [overflow-wrap:anywhere]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <VerdictBadge verdict={e.verdict} />
            <span className="font-mono text-xs text-faint">{e.idsLabel}</span>
          </div>
          <Link href={e.href} className="font-display text-lg font-semibold leading-snug text-fg no-underline hover:text-accent">
            {e.title}
          </Link>
          <MiniLadder ladder={e.ladder} topLabel={topLabel(e.topConfirmed ? RUNG_SHORT[e.topConfirmed] : null)} />
          <p className="m-0 text-[15px] leading-normal text-fg-2">
            {e.category && <span className="block font-mono text-xs tracking-[0.08em] text-muted">{e.category.label.toUpperCase()}</span>}
            {e.exposure}
          </p>
          {(e.category?.doThis ?? e.question) && (
            <p className="m-0 text-[15px] leading-normal text-fg">
              <span className="block font-mono text-xs tracking-[0.08em] text-accent">DO THIS</span>
              {e.category?.doThis ?? e.question}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function EventsTable({ events, total }: { events: EventRow[]; total: number }) {
  return (
    <section id="events" aria-labelledby="ev" className="flex scroll-mt-4 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Eyebrow>{"// EVIDENCE LADDER"}</Eyebrow>
          <H2 id="ev">Active events</H2>
          <p className="m-0 max-w-[680px] text-[15px] leading-normal text-muted">Every event climbs five rungs. We rate on evidence.</p>
        </div>
        <LadderKey />
      </div>
      <YourVendors />
      <EventsGrid events={events} label="Active events with evidence ladder and verdict" />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[15px] text-muted">
        <p className="m-0">
          {total > events.length
            ? `Showing ${events.length} of ${total} tracked events. Act now events with an attack or exploitation report from the last 30 days are listed first, and the most recent Watch and Low events fill the rest. Older Act now events are on the events page.`
            : `Showing all ${total} tracked events.`}
        </p>
        <Link href="/events" className="py-2 font-mono text-sm font-bold tracking-[0.06em]">
          SEE ALL EVENTS →
        </Link>
      </div>
    </section>
  );
}

const BAR_TONE: Record<DriverBar["tone"], string> = { accent: "bg-accent", warn: "bg-warn", crit: "bg-crit" };

export function Drivers({ d }: { d: HomeData["drivers"] }) {
  return (
    <section id="trends" aria-labelledby="why" className="grid scroll-mt-4 grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-8">
      <div className="flex flex-col gap-[18px]">
        <Eyebrow>{"// DRIVERS"}</Eyebrow>
        <H2 id="why">Why this is happening</H2>
        <div className="flex flex-col gap-[18px] text-base leading-[1.6] text-fg-2">
          {d.paragraphs.map((p) => (
            <p key={p.lead} className="m-0">
              <strong className="text-fg">{p.lead}</strong> {p.text}
              {p.src ? (
                <>
                  {" "}
                  <a href={p.src.url} target="_blank" rel="noopener noreferrer" className="break-words font-mono text-xs text-faint underline decoration-line-strong underline-offset-2 hover:text-fg">
                    {p.src.label}
                  </a>
                </>
              ) : null}
            </p>
          ))}
        </div>
      </div>
      <figure className="m-0 flex flex-col gap-[22px] rounded border border-line bg-surface p-6 sm:p-7">
        <figcaption className="flex flex-col gap-1.5">
          <div className="font-mono text-xs tracking-[0.1em] text-muted">{d.barsCaption}</div>
          <div className="font-display text-[22px] font-semibold">{d.barsTitle}</div>
        </figcaption>
        <ul className="m-0 flex list-none flex-col gap-[18px] p-0 font-mono">
          {d.bars.map((b) => (
            <li key={b.label} className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px] text-fg-2">
                <span>{b.label}</span>
                <span className="font-bold text-fg">{b.value}</span>
              </div>
              <div className="h-2.5 bg-line-soft" role="presentation">
                <div className={`h-2.5 ${BAR_TONE[b.tone]}`} style={{ width: `${b.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <div className="font-mono text-xs text-faint">
          SRC:{" "}
          {d.barsSources.map((x, i) => (
            <span key={x.url}>
              {i > 0 ? " · " : ""}
              <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-faint underline decoration-line-strong underline-offset-2 hover:text-fg">
                {x.label}
              </a>
            </span>
          ))}
        </div>
      </figure>
    </section>
  );
}

export function Ransomware({ stats }: { stats: HomeData["ransomware"] }) {
  return (
    <section aria-labelledby="rw" className="rounded border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-6 py-[22px] sm:px-7">
        <H2 id="rw" size="sm">Ransomware pulse</H2>
        <div className="font-mono text-xs tracking-[0.06em] text-muted">LEAK-SITE CLAIMS · NOT CONFIRMED BREACHES</div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {stats.map((s) => (
          <div key={s.value} className="flex flex-col gap-1.5 border-r border-line-soft px-6 py-6 last:border-r-0 sm:px-7">
            <div className="break-words font-mono text-4xl font-bold">{s.value}</div>
            <div className="text-sm text-fg-2">{s.text}</div>
            <SourceTag source={s.source} url={s.sourceUrl} asOf={s.asOf} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Why the site exists, in one line and one short paragraph. Sits above the weekly bottom line. */
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "SRC: NAME · JUL 28, 2026", with the name linked to the page the figure comes from. */
export function SourceTag({ source, url, asOf, className = "" }: { source: string; url?: string; asOf?: string; className?: string }) {
  const d = asOf ? new Date(`${asOf}T00:00:00Z`) : null;
  const date = d && !Number.isNaN(d.getTime()) ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : null;
  return (
    <div className={`font-mono text-xs text-faint ${className}`}>
      SRC:{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-faint underline decoration-line-strong underline-offset-2 hover:text-fg">
          {source}
        </a>
      ) : (
        source
      )}
      {date ? <> · <time dateTime={asOf}>{date}</time></> : null}
    </div>
  );
}

export function Mission() {
  return (
    <section aria-label="Why this site exists" className="flex flex-col gap-3 border-b border-line pb-10">
      <p className="m-0 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] text-fg sm:text-[52px]">
        Cut through the noise<span className="text-accent">.</span>
      </p>
      <p className="m-0 max-w-[760px] text-[17px] leading-[1.55] text-fg-2 sm:text-[19px]">
        Hundreds of new security flaws and breach claims appear every week. Few turn into real attacks. We check each one
        against public evidence and show you what is real, what is noise, and what needs action now.
      </p>
    </section>
  );
}

export function MainShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-14 px-4 pb-[72px] pt-10 sm:px-6">
      {children}
    </main>
  );
}
