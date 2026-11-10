import Link from "next/link";
import type { ReactNode } from "react";
import type { DriverBar, HomeData, KpiView } from "@/lib/data/types";
import type { DoItem, NoiseItem, TrendsData } from "@/lib/data/types";
import { eventsHref } from "@/lib/data/listing";
import { Eyebrow, H2, MarkBadge, Panel, TierBadge, VERDICT_STYLE, VerdictBadge } from "./ui";

const GRID = "grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))]";

export function Hero({ data }: { data: HomeData }) {
  const { top, counts } = data;
  // Low is hidden while the rules produce none; a "0" row only raises the question of why.
  const rows: { v: "act_now" | "watch" | "low" }[] = [{ v: "act_now" }, { v: "watch" }, ...(counts.low > 0 ? [{ v: "low" as const }] : [])];
  return (
    <section aria-labelledby="hero" className="flex flex-wrap items-stretch gap-8">
      <div className="hero-card flex min-w-0 flex-[999_1_min(100%,620px)] flex-col gap-[18px] rounded border border-l-[6px] border-line border-l-crit p-6 sm:p-9">
        <Eyebrow>{`// DO THIS FIRST · WEEK OF ${data.weekOf.toUpperCase()}`}</Eyebrow>
        <h1 id="hero" className="m-0 max-w-[760px] font-display text-[22px] font-bold leading-[1.2] tracking-[-0.02em] sm:text-[32px]">
          {data.weekLine}
        </h1>
        {top.length > 0 && (
          <ol aria-label="Top flaws to act on" className="m-0 flex list-none flex-col p-0">
            {top.map(({ rank, row }) => (
              <li key={row.id} className="flex gap-4 border-t border-line-soft py-4 first:border-t-0 first:pt-1 sm:gap-5">
                <span aria-hidden className="w-7 shrink-0 font-mono text-[28px] font-bold leading-none text-crit-text sm:w-9 sm:text-[34px]">
                  {rank}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5 [overflow-wrap:anywhere]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Link href={row.href} className="py-2 font-display text-lg font-semibold leading-snug text-fg no-underline hover:text-accent sm:text-xl">
                      {row.title}
                    </Link>
                    <TierBadge tier={row.tier} />
                    <MarkBadge mark={row.mark} />
                  </div>
                  <p className="m-0 text-[15px] leading-normal text-fg-2 sm:text-base">
                    <span className="font-mono text-xs font-bold tracking-[0.08em] text-accent">DO THIS </span>
                    {row.category?.doThis ?? row.question ?? row.exposure}
                  </p>
                  {row.idsLabel && <span className="font-mono text-xs text-faint">{row.idsLabel}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-3 pt-1.5">
          <Link href="/events" className="rounded-[3px] bg-accent px-5 py-3.5 font-mono text-sm font-bold tracking-[0.06em] text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink">
            ALL {counts.total} EVENTS →
          </Link>
          <Link href="/vendors" className="rounded-[3px] border border-line-strong px-5 py-[13px] font-mono text-sm tracking-[0.06em] text-fg no-underline hover:text-fg">
            CHECK YOUR VENDORS
          </Link>
          <a href="/brief/feed.xml" className="self-center px-1 py-3 font-mono text-[13px] tracking-[0.06em] text-muted hover:text-accent">
            WEEKLY RSS
          </a>
        </div>
      </div>

      <Panel className="flex flex-[1_1_300px] flex-col gap-5 self-start p-6 sm:p-7">
        <Eyebrow>{`// TRACKED EVENTS · ${counts.total}`}</Eyebrow>
        <ul className="m-0 flex list-none gap-3 p-0">
          {rows.map(({ v }) => {
            const s = VERDICT_STYLE[v];
            return (
              <li key={v} className="min-w-0 flex-1">
                <Link href={eventsHref(v, 1)} className="flex flex-col gap-1 rounded-[3px] border border-line-soft px-4 py-3 font-mono text-fg no-underline hover:border-accent hover:text-fg">
                  <span className="text-[32px] font-bold leading-none tabular-nums">{counts[v]}</span>
                  <span className={`text-xs tracking-[0.08em] ${s.text}`}>{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-3 border-t border-line-soft pt-5">
          <h2 className="m-0 font-mono text-xs font-bold tracking-[0.1em] text-muted">NEW OR CHANGED IN THE LAST 7 DAYS</h2>
          {data.changed.length === 0 ? (
            <p className="m-0 text-[15px] leading-normal text-muted">Nothing outside the list on this page was added or changed its verdict this week.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {data.changed.map((e) => (
                <li key={e.id} className="relative flex flex-col gap-1.5 border-t border-line-soft py-3 first:border-t-0 first:pt-0 [overflow-wrap:anywhere]">
                  <Link href={e.href} className="font-display text-base font-semibold leading-snug text-fg no-underline after:absolute after:inset-0 after:content-[''] hover:text-accent">
                    {e.title}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2">
                    <VerdictBadge verdict={e.verdict} />
                    <TierBadge tier={e.tier} />
                    <MarkBadge mark={e.mark} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {data.kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1.5 border-t border-line-soft pt-5">
            <div className="font-mono text-xs tracking-[0.08em] text-muted">{k.label}</div>
            <div className="flex flex-wrap items-baseline gap-3 font-mono">
              <span className="text-[32px] font-bold leading-none tabular-nums">{k.value}</span>
              <span className={`text-[13px] ${DELTA_TONE[k.deltaTone]}`}>{k.delta}</span>
            </div>
            <div className="text-sm leading-normal text-fg-2">{k.meaning}</div>
            <SourceTag source={k.source} url={k.sourceUrl} asOf={k.asOf} />
          </div>
        ))}
        <p className="m-0 border-t border-line-soft pt-5 text-sm leading-normal text-muted">
          {data.countsNote} <Link href="/methodology" className="underline">How verdicts work</Link>
        </p>
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

/** Three plain steps under the top list. */
export function Steps({ steps }: { steps: DoItem[] }) {
  return (
    <section aria-labelledby="steps" className="flex flex-col gap-4">
      <h2 id="steps" className="m-0 font-mono text-sm font-bold tracking-[0.12em] text-accent">→ WHAT TO DO WITH THIS LIST</h2>
      <ol className={`m-0 grid list-none gap-x-8 gap-y-4 rounded border border-line bg-surface p-6 sm:p-7 ${GRID}`}>
        {steps.map((a, i) => (
          <li key={a.lead} className="flex gap-4">
            <span aria-hidden className="font-mono text-[28px] font-bold leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[15px] leading-normal text-fg-2">
              <strong className="text-fg">{a.lead}</strong> {a.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One line to the pages that hold everything the home page leaves out. */
export function MoreLinks({ total }: { total: number }) {
  const link = "rounded-[3px] border border-line-strong px-5 py-[13px] font-mono text-sm tracking-[0.06em] text-fg no-underline hover:border-accent hover:text-fg";
  return (
    <nav aria-label="More on this site" className="flex flex-wrap gap-3 border-t border-line pt-8">
      <Link href="/events" className={link}>ALL {total} EVENTS →</Link>
      <Link href="/trends" className={link}>TRENDS FROM PUBLISHED REPORTS →</Link>
      <Link href="/track-record" className={link}>HOW OFTEN WE ARE RIGHT →</Link>
    </nav>
  );
}

export function Noise({ noise }: { noise: NoiseItem[] }) {
  return (
    <section aria-labelledby="noise" className="flex flex-col gap-5">
      <Eyebrow>{"// NOISE"}</Eyebrow>
      <H2 id="noise">Claims that do not hold up</H2>
      <div className={`grid gap-x-8 gap-y-6 rounded border border-line bg-surface p-6 sm:p-7 ${GRID}`}>
        {noise.map((n) => (
          <div key={n.title} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[17px] font-semibold text-muted line-through decoration-faint">{n.title}</span>
              <span className="rounded-sm border border-line-strong px-1.5 py-[3px] font-mono text-xs tracking-[0.1em] text-muted">{n.tag}</span>
            </div>
            <div className="text-[15px] leading-normal text-fg-2">{n.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const BAR_TONE: Record<DriverBar["tone"], string> = { accent: "bg-accent", warn: "bg-warn", crit: "bg-crit" };

export function Drivers({ d }: { d: TrendsData["drivers"] }) {
  return (
    <section aria-labelledby="why" className="grid scroll-mt-4 grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-8">
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

export function Ransomware({ stats }: { stats: TrendsData["ransomware"] }) {
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

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "SRC: NAME · JUL 28, 2026", with the name linked to the page the figure comes from. */
export function SourceTag({ source, url, asOf, className = "" }: { source: string; url?: string; asOf?: string; className?: string }) {
  const d = asOf ? new Date(`${asOf}T00:00:00Z`) : null;
  const date = d && !Number.isNaN(d.getTime()) ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : null;
  return (
    <div className={`font-mono text-xs text-faint ${className}`}>
      SRC:{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 text-faint underline decoration-line-strong underline-offset-2 hover:text-fg">
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
    <p className="m-0 max-w-[860px] text-[15px] leading-[1.5] text-fg-2 sm:text-[17px]">
      <strong className="font-display text-fg">Cut through the noise.</strong> Hundreds of new security flaws and breach claims appear every week. Few turn into
      real attacks. We check each one against public evidence and show what needs action now.
    </p>
  );
}

export function MainShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-[72px] pt-6 sm:gap-12 sm:px-6 sm:pt-8">
      {children}
    </main>
  );
}
