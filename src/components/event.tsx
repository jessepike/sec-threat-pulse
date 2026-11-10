import { NOT_SURE } from "@/lib/ladder/category";
import Link from "next/link";
import type { ClaimRating, EventView, ProductChip, RungView, SourceRef } from "@/lib/data/types";
import { RUNG_SHORT } from "@/lib/data/sample";
import { fmtDay, fmtDayYear } from "@/lib/data/format";
import { Eyebrow, H2, LadderKey, MiniLadder, Panel, Seg, TierBadge, VERDICT_STYLE, VerdictBadge, ladderLabel } from "./ui";

export function EventHero({ e }: { e: EventView }) {
  const v = VERDICT_STYLE[e.verdict];
  const borderTone = e.verdict === "act_now" ? "border-l-crit" : e.verdict === "watch" ? "border-l-warn" : "border-l-ok";
  return (
    <section aria-labelledby="t" className="flex flex-col gap-[18px]">
      <nav aria-label="Breadcrumb" className="font-mono text-xs tracking-[0.08em] text-muted">
        <Link href="/" className="inline-block py-3 no-underline">THIS WEEK</Link> / <Link href="/events" className="inline-block py-3 no-underline">EVENTS</Link> / <span className="uppercase">{e.title}</span>
      </nav>
      <div className={`hero-card flex flex-wrap gap-8 rounded border border-l-8 border-line p-6 sm:p-9 ${borderTone}`}>
        <div className="flex min-w-0 flex-[999_1_min(100%,560px)] flex-col gap-[18px]">
          <div className="flex flex-wrap items-center gap-3.5">
            <VerdictBadge verdict={e.verdict} large />
            <TierBadge tier={e.tier} large />
            <span className="font-mono text-[13px] text-muted">
              {[...e.cves, e.cvss ? `CVSS ${e.cvss.toFixed(1)}` : null].filter(Boolean).join(" · ") || e.idsLabel}
            </span>
          </div>
          <h1 id="t" className="m-0 break-words font-display text-[44px] font-bold leading-none tracking-[-0.035em] sm:text-[72px]">
            {e.title}
          </h1>
          {e.products && e.products.length > 0 && <AffectedProducts products={e.products} />}
          {e.technicalNames && (
            <p className="m-0 font-mono text-[13px] leading-relaxed tracking-[0.02em] text-muted">
              <span className="text-faint">OFFICIAL NAME{e.technicalNames.length > 1 ? "S" : ""}: </span>
              {e.technicalNames.join(" · ")}
            </p>
          )}
          {e.category && e.category.id !== "other" && (
            <p className="m-0 max-w-[720px] text-lg leading-[1.55] text-fg sm:text-xl">
              <span className="block font-mono text-xs tracking-[0.1em] text-muted">WHAT IT IS · {e.category.label.toUpperCase()}</span>
              {e.businessTerms}
            </p>
          )}
          {e.doThis && (
            <p className="m-0 max-w-[720px] text-lg leading-[1.55] text-fg sm:text-xl">
              <span className="block font-mono text-xs font-bold tracking-[0.1em] text-accent">DO THIS FIRST</span>
              {e.doThis} <span className="text-fg-2">{NOT_SURE}</span>
            </p>
          )}
          {e.summary && (
            <p className="m-0 max-w-[720px] text-[15px] leading-[1.55] text-muted">
              <span className="font-mono text-xs tracking-[0.1em]">TECHNICAL SUMMARY </span>
              {e.summary}
            </p>
          )}
          {e.verdictReason && (
            <p className="m-0 max-w-[720px] text-[15px] leading-normal text-muted">
              <span className={`font-mono text-xs font-bold tracking-[0.1em] ${v.text}`}>WHY THIS VERDICT </span>
              {e.verdictReason}
            </p>
          )}
          {e.rankWhy && e.rankWhy.length > 0 && (
            <p className="m-0 text-[15px] leading-relaxed text-fg-2">
              <span className="font-mono text-xs font-bold tracking-[0.1em] text-muted">WHY IT RANKS HERE </span>
              {e.rankWhy.join(" ")}
            </p>
          )}
        </div>
        <dl className="m-0 flex flex-[1_1_260px] flex-col gap-3.5 border-line pl-0 font-mono md:border-l md:pl-7">
          {e.facts.map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <dt className="text-xs tracking-[0.08em] text-muted">{f.label}</dt>
              <dd className={`m-0 text-[22px] font-bold ${f.tone === "ok" ? "text-ok-text" : ""}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Direct products as chips, then one line for products that ship the component, with its reference. */
export function AffectedProducts({ products }: { products: ProductChip[] }) {
  const direct = products.filter((p) => p.kind === "direct");
  const embedded = products.filter((p) => p.kind === "embedded");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs tracking-[0.1em] text-muted">AFFECTS</span>
        {direct.map((p) => (
          <Link key={p.slug} href={`/events?product=${encodeURIComponent(p.slug)}`} className="rounded-sm border border-line-strong bg-surface px-3 py-2.5 font-mono text-[13px] text-fg no-underline hover:border-accent hover:text-accent">
            {p.label}
          </Link>
        ))}
      </div>
      {embedded.length > 0 && (
        <p className="m-0 max-w-[720px] text-[15px] leading-normal text-muted">
          <span className="font-mono text-xs tracking-[0.1em]">ALSO SHIPS INSIDE </span>
          {embedded.map((p) => p.label).join(", ")}
          {embedded[0].ref && (
            <>
              {" "}
              (<a href={embedded[0].ref} target="_blank" rel="noopener noreferrer" className="text-muted underline hover:text-accent">source</a>)
            </>
          )}
          . Check with those vendors too.
        </p>
      )}
    </div>
  );
}

/** The clock: disclosure, exploit code, first attack report, KEV listing and deadline, each linked to what set it. */
export function EventClock({ e }: { e: EventView }) {
  const c = e.clock;
  if (!c) return null;
  return (
    <section aria-labelledby="clock" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <Eyebrow>{"// THE CLOCK"}</Eyebrow>
        <H2 id="clock" size="md">When each thing happened</H2>
      </div>
      <div className="rounded border border-line bg-surface">
        <ol role="list" className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-5">
          {c.points.map((p) => (
            <li key={p.key} className="flex flex-col gap-1.5 border-b border-line-soft p-5 lg:border-b-0 lg:border-r lg:last:border-r-0">
              <div className="font-mono text-xs tracking-[0.1em] text-muted">{p.label.toUpperCase()}</div>
              <div className={`font-mono text-[22px] font-bold leading-none ${p.date ? "" : "text-faint"}`}>
                {p.date ? <time dateTime={p.date}>{fmtDayYear(p.date)}</time> : (p.pending ?? "NOT YET")}
              </div>
              {p.source && (
                <div className="font-mono text-xs leading-normal text-faint">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 text-faint underline hover:text-accent">
                      {p.source}
                    </a>
                  ) : (
                    p.source
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
        {c.note && <div className="border-t border-line bg-surface-2 px-5 py-3.5 text-[15px] leading-[1.55] text-fg-2">{c.note}</div>}
      </div>
    </section>
  );
}

const STATE_LOOK: Record<RungView["state"], { status: string; cls: string }> = {
  confirmed: { status: "■ CONFIRMED", cls: "text-accent" },
  reported: { status: "▨ REPORTED, NOT CONFIRMED", cls: "text-accent-hover" },
  none: { status: "□ NO EVIDENCE YET", cls: "text-muted" },
};

const UNTRACKED_LOOK = { status: "□ NOT TRACKED YET", cls: "text-faint" };

function SourceList({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return <div className="font-mono text-xs leading-normal text-faint">SRC: NONE YET</div>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs leading-normal text-faint">
      {sources.map((s) => (
        <li key={`${s.label}${s.url ?? ""}`}>
          SRC:{" "}
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 text-faint underline hover:text-accent">
              {s.label}
            </a>
          ) : (
            s.label
          )}
          {s.at ? ` · ${fmtDay(s.at)}` : ""}
        </li>
      ))}
    </ul>
  );
}

export function FullLadder({ e }: { e: EventView }) {
  return (
    <section aria-labelledby="ladder" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Eyebrow>{"// EVIDENCE LADDER"}</Eyebrow>
          <H2 id="ladder">How far has it climbed?</H2>
        </div>
        <LadderKey />
      </div>
      <div className="rounded border border-line bg-surface">
        <ol role="list" aria-label={`Evidence ladder. ${ladderLabel(e.ladder)}`} className="m-0 grid list-none grid-cols-1 p-0 md:grid-cols-2 lg:grid-cols-5">
          {e.rungs.map((r) => {
            const look = r.untracked ? UNTRACKED_LOOK : STATE_LOOK[r.state];
            return (
              <li key={r.rung} className="flex flex-col gap-3.5 border-b border-line-soft p-6 lg:border-b-0 lg:border-r lg:last:border-r-0">
                <h3 className="m-0 font-mono text-[13px] font-bold tracking-[0.1em]">
                  {r.num} {RUNG_SHORT[r.rung]}
                </h3>
                <Seg state={r.state} large />
                <div className={`font-mono text-xs font-bold tracking-[0.08em] ${look.cls}`}>{look.status}</div>
                <div className="font-mono text-xs tracking-[0.06em] text-muted">
                  {r.untracked ? (
                    "NO SOURCE FOR THIS STEP YET"
                  ) : (
                    <>NEWEST EVIDENCE {r.newestAt ? <time dateTime={r.newestAt}>{fmtDayYear(r.newestAt)}</time> : "NONE YET"}</>
                  )}
                  {r.sourceCount ? ` · ${r.sourceCount} ${r.sourceCount === 1 ? "SOURCE" : "INDEPENDENT SOURCES"}` : ""}
                </div>
                <p className="m-0 text-sm leading-[1.55] text-fg-2">{r.evidence}</p>
                <div className="mt-auto">
                  {r.untracked ? null : <SourceList sources={r.sources} />}
                </div>
              </li>
            );
          })}
        </ol>
        {e.verdictChangesIf && (
          <div className="border-t border-line bg-surface-2 px-6 py-[18px] text-[15px] leading-[1.55] text-fg-2">
            <span className="font-mono text-xs font-bold tracking-[0.1em] text-accent">VERDICT CHANGES IF → </span>
            {e.verdictChangesIf}
          </div>
        )}
      </div>
    </section>
  );
}

export function Summary({ e }: { e: EventView }) {
  const items = [
    e.businessTerms && !e.category && { h: "IN BUSINESS TERMS", t: e.businessTerms, hl: false },
    e.whyAct && { h: "WHY ACT BEFORE PROOF OF DAMAGE", t: e.whyAct, hl: false },
    e.fix && { h: "THE FIX", t: e.fix, hl: true },
  ].filter(Boolean) as { h: string; t: string; hl: boolean }[];
  if (items.length === 0) return null;
  return (
    <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] rounded border border-line bg-surface">
      {items.map((i) => (
        <div key={i.h} className={`flex flex-col gap-2.5 border-r border-line-soft p-6 last:border-r-0 sm:p-[26px] ${i.hl ? "bg-surface-2" : ""}`}>
          <h2 className={`m-0 font-mono text-xs font-bold tracking-[0.1em] ${i.hl ? "text-accent" : "text-muted"}`}>{i.h}</h2>
          <p className="m-0 text-base leading-[1.6] text-fg-2">{i.t}</p>
        </div>
      ))}
    </section>
  );
}

const RATING: Record<ClaimRating, string> = {
  TRUE: "text-crit-text bg-crit-bg border-crit",
  OVERSTATED: "text-warn-text bg-warn-bg border-warn",
  "TOO EARLY": "text-fg-2 bg-line-soft border-line-strong",
  FALSE: "text-ok-text bg-ok-bg border-ok",
  UNVERIFIED: "text-fg-2 bg-line-soft border-line-strong",
};

export function ClaimCheck({ e }: { e: EventView }) {
  if (e.claims.length === 0) return null;
  const head = "px-6 py-3.5 text-left font-mono text-xs font-normal tracking-[0.08em] text-muted";
  return (
    <section aria-labelledby="hype" className="flex flex-col gap-5">
      <Eyebrow>{"// CLAIM CHECK"}</Eyebrow>
      <H2 id="hype">{"What you heard vs what's true"}</H2>
      <div className="overflow-x-auto rounded border border-line bg-surface" tabIndex={0} role="region" aria-label="Claim check table, scrolls sideways on small screens">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={`${head} w-[37%]`}>CLAIM</th>
              <th scope="col" className={`${head} w-[40%]`}>WHAT THE EVIDENCE SAYS</th>
              <th scope="col" className={`${head} w-[23%]`}>RATING</th>
            </tr>
          </thead>
          <tbody>
            {e.claims.map((c) => (
              <tr key={c.claim} className="border-b border-line-soft last:border-b-0">
                <th scope="row" className="px-6 py-[18px] text-left align-top font-display text-[17px] font-semibold">{c.claim}</th>
                <td className="px-6 py-[18px] align-top text-[15px] leading-[1.55] text-fg-2">{c.truth}</td>
                <td className="px-6 py-[18px] align-top">
                  <span className={`inline-block whitespace-nowrap rounded-sm border px-[9px] py-1.5 font-mono text-xs font-bold tracking-[0.08em] ${RATING[c.rating]}`}>{c.rating}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TimelineAndBlast({ e }: { e: EventView }) {
  if (e.timeline.length === 0 && !e.blast) return null;
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-8">
      {e.timeline.length > 0 && (
        <div className="flex flex-col gap-[18px]">
          <Eyebrow>{"// TIMELINE · PACIFIC TIME"}</Eyebrow>
          <H2 id="tl" size="md">How it unfolded</H2>
          <ol className="m-0 ml-1.5 flex list-none flex-col border-l border-line-strong p-0" aria-labelledby="tl">
            {e.timeline.map((m) => (
              <li key={m.when + m.what} className="relative flex flex-col gap-1 pb-[22px] pl-6">
                <span aria-hidden="true" className={`absolute -left-1.5 top-[3px] box-border size-[11px] rounded-full ${m.hot ? "bg-crit" : "border-2 border-accent bg-bg"}`} />
                <div className={`font-mono text-[13px] font-bold tracking-[0.06em] ${m.hot ? "text-crit-text" : "text-accent"}`}>
                  {m.hot && <span className="sr-only">Attack activity. </span>}
                  {m.when}
                </div>
                <div className="text-[15px] leading-[1.55] text-fg-2">{m.what}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {e.blast && (
        <div className="flex flex-col gap-[18px]">
          <Eyebrow>{"// BLAST RADIUS"}</Eyebrow>
          <H2 size="md">Who is exposed</H2>
          <Panel className="flex flex-col gap-[18px] p-6 sm:p-[26px]">
            {e.blast.headline && (
              <div className="flex flex-wrap items-baseline gap-3.5">
                <div className="font-mono text-[56px] font-bold leading-none">{e.blast.headline.value}</div>
                <div className="max-w-[260px] text-[15px] text-fg-2">{e.blast.headline.text}</div>
              </div>
            )}
            {e.blast.paragraphs.map((p) => (
              <p key={p.lead} className="m-0 text-[15px] leading-[1.55] text-fg-2">
                <strong className="text-fg">{p.lead}</strong> {p.text}
              </p>
            ))}
            {e.blast.note && (
              <div className="rounded-[3px] border border-dashed border-line-strong px-4 py-3.5 font-mono text-xs leading-[1.6] tracking-[0.04em] text-muted">{e.blast.note.toUpperCase()}</div>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}

export function AskYourTeam({ e }: { e: EventView }) {
  const qs = e.askYourTeam ?? [];
  if (qs.length === 0 && !e.aiDrafted) return null;
  return (
    <section aria-labelledby="ask" className="flex flex-col gap-4">
      {qs.length > 0 && (
        <>
          <Eyebrow>{"// ASK YOUR TEAM"}</Eyebrow>
          <H2 id="ask" size="md">Questions to ask this week</H2>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-base leading-[1.6] text-fg-2">
            {qs.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
      {e.aiDrafted && <p className="m-0 font-mono text-xs tracking-[0.06em] text-muted">AI-drafted, reviewed by STP</p>}
    </section>
  );
}

export function Roles({ e }: { e: EventView }) {
  if (e.roles.length === 0) return null;
  return (
    <section aria-labelledby="act" className="flex flex-col gap-5">
      <Eyebrow>{"// ACTIONS BY ROLE"}</Eyebrow>
      <H2 id="act">What each leader should do</H2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] rounded border border-line bg-surface">
        {e.roles.map((r) => (
          <div key={r.role} className="flex flex-col gap-4 border-b border-r border-line-soft p-6 sm:p-[26px]">
            <h3 className="m-0 font-mono text-lg font-bold tracking-[0.1em] text-accent">{r.role}</h3>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {r.items.map((t, i) => (
                <li key={t} className="flex gap-3 text-[15px] leading-[1.55] text-fg-2">
                  <span className="pt-0.5 font-mono text-[13px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Sources({ e }: { e: EventView }) {
  return (
    <section aria-labelledby="src" className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 id="src" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">SOURCES</h2>
      {e.sources.length === 0 ? (
        <p className="m-0 font-mono text-xs text-faint">No sources recorded yet.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-xs leading-[1.6] text-muted">
          {e.sources.map((s, i) => (
            <li key={s.label + (s.url ?? "")}>
              [{i + 1}]{" "}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 underline">
                  {s.label}
                </a>
              ) : (
                s.label
              )}
              {s.at ? `, ${fmtDay(s.at)}` : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export { MiniLadder };
