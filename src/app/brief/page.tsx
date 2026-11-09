import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { Seg } from "@/components/ui";
import { getBriefData } from "@/lib/data";
import { RUNG_SHORT } from "@/lib/data/sample";
import { RUNGS } from "@/lib/ladder/types";
import { pageMeta } from "@/lib/site";

export const revalidate = 1800;
export const metadata: Metadata = pageMeta({ title: "Board brief", description: "A one-page, printable weekly summary for boards and executives.", path: "/brief" });

const LAB = "font-mono text-[11px] font-bold tracking-[0.1em] text-[var(--b-muted)]";

export default async function BriefPage() {
  const { brief: b, mode } = await getBriefData();
  const ladderWord = { confirmed: "", reported: " (REPORTED)", none: "" } as const;
  const glyph = { confirmed: "■", reported: "▨", none: "□" } as const;
  return (
    <div className="brief-wrap min-h-screen bg-[#e6eaee] px-3 py-6 sm:px-6">
      <a href="#main" className="skip-link no-print">
        Skip to content
      </a>
      <div className="no-print mx-auto mb-4 flex max-w-[816px] flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-mono text-[13px] tracking-[0.06em] text-[#0b5c94]">← BACK TO THIS WEEK</Link>
        <PrintButton />
      </div>
      <main id="main" className="brief-sheet mx-auto box-border flex w-full max-w-[816px] flex-col gap-[22px] px-5 py-8 shadow-[0_2px_16px_rgba(10,14,19,0.18)] sm:min-h-[1056px] sm:px-[60px] sm:py-[52px]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--b-ink)] pb-3">
          <div className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
              <rect x="0.5" y="0.5" width="27" height="27" rx="4" fill="none" stroke="#0a0e13" />
              <path d="M4 14h5l2.5-6 5 12 2.5-6h5" fill="none" stroke="#0b5c94" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 className="m-0 font-mono text-[13px] font-bold tracking-[0.12em]">SECURITY_THREAT_PULSE · BOARD BRIEF</h1>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs tracking-[0.06em] text-[var(--b-muted)]">
            {mode === "sample" && <span className="border border-[#7a5300] px-1.5 py-0.5 text-[11px] font-bold text-[#7a5300]">SAMPLE DATA</span>}
            WEEK OF {b.weekOf.toUpperCase()}
          </div>
        </header>

        <section aria-labelledby="bl" className="flex flex-wrap items-stretch gap-5">
          <div className="flex min-w-[220px] flex-[1_1_320px] flex-col gap-2 border-l-[6px] border-[#c2352a] pl-[18px]">
            <h2 id="bl" className={`m-0 ${LAB}`}>BOTTOM LINE</h2>
            <p className="m-0 font-display text-2xl font-bold leading-[1.2] tracking-[-0.02em] sm:text-[26px]">{b.bottomLine}</p>
          </div>
          <div className="flex flex-[0_0_170px] flex-col gap-2.5 border border-[var(--b-line)] p-3.5 font-mono">
            <h2 className={`m-0 ${LAB}`}>TRACKED EVENTS</h2>
            <div className="flex justify-between text-[13px]"><span className="font-bold text-[#9b2a21]">▲ ACT NOW</span><span className="font-bold">{b.counts.act_now}</span></div>
            <div className="flex justify-between text-[13px]"><span className="font-bold text-[#7a5300]">◆ WATCH</span><span className="font-bold">{b.counts.watch}</span></div>
            <div className="flex justify-between text-[13px]"><span className="font-bold text-[#2e6b4c]">● LOW</span><span className="font-bold">{b.counts.low}</span></div>
          </div>
        </section>

        <section aria-labelledby="wc" className="flex flex-col gap-2.5">
          <h2 id="wc" className={`m-0 ${LAB}`}>WHAT CHANGED THIS WEEK</h2>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13.5px] leading-normal text-[var(--b-ink-2)]">
            {b.changes.length === 0 && <li>No events changed in the last 7 days.</li>}
            {b.changes.map((c, i) => (
              <li key={c.lead} className="flex gap-3">
                <span className="font-mono font-bold text-[var(--b-accent)]">{String(i + 1).padStart(2, "0")}</span>
                <span><strong className="text-[var(--b-ink)]">{c.lead}</strong> {c.text}</span>
              </li>
            ))}
          </ol>
        </section>

        {b.flagship && (
          <section aria-labelledby="ld" className="flex flex-col gap-2.5">
            <h2 id="ld" className={`m-0 ${LAB}`}>{b.flagship.title.toUpperCase()} · EVIDENCE LADDER</h2>
            <div className="grid grid-cols-5 gap-1" role="img" aria-label={RUNGS.map((r) => `${RUNG_SHORT[r].toLowerCase()}: ${b.flagship!.ladder[r]}`).join(", ")}>
              {RUNGS.map((r) => {
                const s = b.flagship!.ladder[r];
                return (
                  <div key={r} className="flex flex-col gap-1.5">
                    <Seg state={s} large />
                    <span className={`font-mono text-[10.5px] tracking-[0.06em] ${s === "none" ? "text-[var(--b-muted)]" : ""}`}>
                      {glyph[s]} {RUNG_SHORT[r]}{ladderWord[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="op" className="flex flex-col gap-2.5">
          <h2 id="op" className={`m-0 ${LAB}`}>OUR POSITION</h2>
          <div className="overflow-x-auto border border-[var(--b-line)]">
            <table className="w-full min-w-[460px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-[var(--b-head)] font-mono text-[11px] tracking-[0.08em] text-[var(--b-ink-2)]">
                  <th scope="col" className="w-[40%] px-3.5 py-2 text-left font-bold">ITEM</th>
                  <th scope="col" className="w-[20%] px-3.5 py-2 text-left font-bold">STATUS</th>
                  <th scope="col" className="w-[40%] px-3.5 py-2 text-left font-bold">NOTE</th>
                </tr>
              </thead>
              <tbody>
                {b.position.map((p) => (
                  <tr key={p.item} className="border-t border-[var(--b-line-soft)]">
                    <th scope="row" className="px-3.5 py-2.5 text-left font-normal">{p.item}</th>
                    <td className="px-3.5 py-2.5 font-mono text-[var(--b-muted)]">{p.status}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[var(--b-muted)]">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="no-print m-0 font-mono text-[11px] text-[var(--b-muted)]">Bracketed fields are for management to fill in before the meeting.</p>
        </section>

        <div className="flex flex-wrap gap-6">
          <section aria-labelledby="nc" className="flex min-w-[220px] flex-[1_1_0] flex-col gap-2">
            <h2 id="nc" className={`m-0 ${LAB}`}>✕ NOT A CONCERN</h2>
            <p className="m-0 text-[13px] leading-[1.55] text-[var(--b-ink-2)]">{b.notConcern}</p>
          </section>
          <section aria-labelledby="qm" className="flex min-w-[220px] flex-[1_1_0] flex-col gap-2">
            <h2 id="qm" className={`m-0 ${LAB}`}>→ QUESTIONS FOR MANAGEMENT</h2>
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-normal text-[var(--b-ink-2)]">
              {b.questions.map((q, i) => (
                <li key={q} className="flex gap-2.5"><span className="font-mono font-bold text-[var(--b-accent)]">Q{i + 1}</span><span>{q}</span></li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="mt-auto flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--b-line)] pt-2.5 font-mono text-[10.5px] tracking-[0.04em] text-[var(--b-muted)]">
          <div>{b.sourcesLine}</div>
          <div>SECURITYTHREATPULSE.COM · NOT ADVICE · PRE-LAUNCH PREVIEW</div>
        </footer>
      </main>
    </div>
  );
}
