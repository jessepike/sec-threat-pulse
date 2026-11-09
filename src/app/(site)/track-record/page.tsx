import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose";
import { latestReports } from "@/lib/admin/backtest";
import { fmtDayYear } from "@/lib/data/format";
import { pageMeta } from "@/lib/site";
import { ACT_NOW_HORIZON_DAYS, versionRows, WATCH_HORIZON_DAYS, type BacktestRate, type Outcome, type RecordCell, type TrackRecord, type VersionRow } from "@/lib/track-record";
import { cachedTrackRecord } from "@/lib/track-record/cached";

export const revalidate = 1800;

export const metadata: Metadata = pageMeta({
  title: "Track record",
  description: "How often Security Threat Pulse's early Act now calls were right, live and in the backtest, for every rules version, with intervals and lead time.",
  path: "/track-record",
});

/** "Oct 24, 2026" for a YYYY-MM-DD day, read as written. */
const longDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const pct = (x: number | undefined) => (x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
const range = (ci: [number, number] | null | undefined) => (ci ? `${Math.round(ci[0] * 100)} to ${Math.round(ci[1] * 100)}%` : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const OUTCOME: Record<Outcome, { label: string; cls: string }> = {
  right: { label: "RIGHT", cls: "border-ok text-ok-text" },
  wrong: { label: "WRONG", cls: "border-crit text-crit-text" },
  pending: { label: "PENDING", cls: "border-line-strong text-muted" },
};

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface px-4 py-4">
      <div className="font-mono text-[11px] tracking-[0.08em] text-faint">{label}</div>
      <div className="font-display text-[32px] font-bold leading-none text-fg">{value}</div>
      <p className="!text-sm !leading-[1.5] text-muted">{detail}</p>
    </div>
  );
}

/** A 0 to 100% track with the interval shaded and the rate marked. Text beside it carries the numbers. */
function RateBar({ r, label }: { r: { rate: number; ci: [number, number] | null | undefined }; label: string }) {
  const [lo, hi] = r.ci ?? [r.rate, r.rate];
  return (
    <div role="img" aria-label={`${label}: ${pct(r.rate)}${r.ci ? `, likely between ${range(r.ci)}` : ""}`} className="relative h-3 w-full rounded-sm border border-line bg-bg">
      <div className="absolute inset-y-0 bg-accent/30" style={{ left: `${lo * 100}%`, width: `${Math.max((hi - lo) * 100, 0.5)}%` }} />
      <div className="absolute -inset-y-0.5 w-[3px] -translate-x-1/2 bg-accent" style={{ left: `${r.rate * 100}%` }} />
    </div>
  );
}

function BacktestLine({ label, r }: { label: string; r: BacktestRate | null }) {
  if (!r) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="text-fg-2">{label}</span>
        <span className="font-mono text-[13px] text-fg">
          {pct(r.rate)} <span className="text-muted">({range(r.ci) ?? "no interval"}; {r.hits} of {r.n})</span>
        </span>
      </div>
      <RateBar r={r} label={label} />
    </div>
  );
}

function liveLine(c: RecordCell | undefined): string {
  if (!c || !c.calls) return "No early Act now calls yet.";
  const settled = c.right + c.wrong;
  const parts = [plural(c.calls, "early call")];
  if (settled) parts.push(`${c.right} right, ${c.wrong} wrong (${pct(c.rate)}${c.ci ? `, ${range(c.ci)}` : ""})`);
  if (c.pending) parts.push(`${c.pending} pending`);
  return parts.join(". ") + ".";
}

function VersionCard({ v, live }: { v: VersionRow; live: RecordCell | undefined }) {
  const b = v.backtest;
  return (
    <li className="flex flex-col gap-4 rounded-sm border border-line px-4 py-4 !pl-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="font-mono text-base">{v.version}</strong>
        {v.released ? <span className="font-mono text-xs tracking-[0.06em] text-muted">RELEASED {fmtDayYear(v.released)}</span> : null}
        {v.active ? <span className="rounded-sm border border-ok px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-ok-text">ACTIVE</span> : null}
      </div>
      {v.summary ? <p className="!text-sm">{v.summary}</p> : null}
      {b ? (
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[11px] tracking-[0.08em] text-faint">
            BACKTEST{v.verdictsFrom && b.reportVersion !== v.version ? `, SAME VERDICTS AS ${v.verdictsFrom.toUpperCase()}` : ""} · {fmtDayYear(b.window.from)} TO {fmtDayYear(b.window.to)}
          </div>
          <BacktestLine label={`Early Act now right within ${ACT_NOW_HORIZON_DAYS} days, whole window`} r={b.actNowAll} />
          <BacktestLine label={`Same, on the held-out months (${fmtDayYear(b.heldOut.from)} on)`} r={b.actNowHeldOut} />
          <BacktestLine label="KEV listings with an Act now before the listing day" r={b.kevCalledBefore} />
          {b.medianLeadDays !== null ? <p className="!text-sm text-muted">Median lead of those early calls: {plural(b.medianLeadDays, "day")}.</p> : null}
        </div>
      ) : (
        <p className="!text-sm text-muted">No backtest report for this version.</p>
      )}
      <div className="flex flex-col gap-1 border-t border-line-soft pt-3">
        <div className="font-mono text-[11px] tracking-[0.08em] text-faint">LIVE</div>
        <p className="!text-sm">{liveLine(live)}</p>
      </div>
    </li>
  );
}

function LiveSection({ data }: { data: TrackRecord }) {
  const a = data.live.actNow.overall;
  const settled = a.right + a.wrong;
  const k = data.live.kevCoverage;
  const nextSettle = data.live.actNow.calls
    .filter((c) => c.outcome === "pending" && c.settlesOn)
    .map((c) => c.settlesOn!)
    .sort()[0];
  return (
    <section id="live">
      <h2>Live since {longDay(data.live.since)}</h2>
      <p>
        Every early Act now call the site has made, scored against KEV. An early call is one made before CISA or VulnCheck listed the flaw as exploited. Updated with every events sync.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label={`RIGHT WITHIN ${ACT_NOW_HORIZON_DAYS} DAYS`}
          value={settled ? `${a.right} of ${settled}` : "None settled"}
          detail={settled ? `${pct(a.rate)} of settled early calls${a.ci ? `, likely ${range(a.ci)}` : ""}.` : nextSettle ? `The first calls settle on ${longDay(nextSettle)}, unless KEV lists them sooner.` : "No early calls yet."}
        />
        <Tile label="PENDING" value={String(a.pending)} detail={`Early calls still inside their ${ACT_NOW_HORIZON_DAYS} day window.`} />
        <Tile
          label="KEV LISTINGS WE CALLED FIRST"
          value={k.listings ? `${k.calledBefore} of ${k.listings}` : "None yet"}
          detail={k.listings ? `${pct(k.share)} of listings since ${longDay(data.live.since)} had an Act now from us first${k.medianLeadDays !== undefined ? `, median ${plural(k.medianLeadDays, "day")} ahead` : ""}.` : "No KEV listings since live history began."}
        />
      </div>
      <p className="!text-sm text-muted">
        {plural(data.live.actNow.postConfirmation, "other Act now call")} came on or after the listing day. Those are right by construction, so they are not scored. Watch or higher calls
        followed by a listing within {WATCH_HORIZON_DAYS} days: {data.live.watch.overall.right} right, {data.live.watch.overall.wrong} wrong, {data.live.watch.overall.pending} pending.
      </p>
    </section>
  );
}

function CallsTable({ data }: { data: TrackRecord }) {
  const calls = data.live.actNow.calls;
  if (!calls.length) return null;
  return (
    <section id="calls">
      <h2>Every early call</h2>
      <p>Newest first. Each row links to the event page and its evidence.</p>
      <ol aria-label="Early Act now calls, newest first" className="!m-0 !flex !list-none !flex-col !gap-0 !p-0 sm:!hidden">
        {calls.map((c) => (
          <li key={c.cveId} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 !pl-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted">
                {fmtDayYear(c.calledOn)} · {c.rulesVersion}
              </span>
              <span className={`inline-block whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.08em] ${OUTCOME[c.outcome].cls}`}>{OUTCOME[c.outcome].label}</span>
            </div>
            <span className="!text-[15px]">{c.url ? <Link href={c.url.replace(/^https?:\/\/[^/]+/, "")}>{c.title}</Link> : c.title}</span>
            <span className="font-mono text-xs text-muted">
              {c.cveId} · {c.kevDate ? `KEV ${fmtDayYear(c.kevDate)}${c.leadDays !== null ? `, ${plural(c.leadDays, "day")} later` : ""}` : c.settlesOn ? `not listed, settles ${fmtDayYear(c.settlesOn)}` : "not listed"}
            </span>
          </li>
        ))}
      </ol>
      <div className="md-table max-sm:!hidden">
        <table>
          <caption className="sr-only">Early Act now calls and their outcomes</caption>
          <thead>
            <tr>
              <th scope="col">CALLED</th>
              <th scope="col">FLAW</th>
              <th scope="col">RULES</th>
              <th scope="col">KEV LISTING</th>
              <th scope="col">OUTCOME</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.cveId}>
                <td className="whitespace-nowrap font-mono text-[13px]">{fmtDayYear(c.calledOn)}</td>
                <td>
                  {c.url ? <Link href={c.url.replace(/^https?:\/\/[^/]+/, "")}>{c.title}</Link> : c.title}
                  <div className="font-mono text-xs text-muted">{c.cveId}</div>
                </td>
                <td className="font-mono text-[13px]">{c.rulesVersion}</td>
                <td className="whitespace-nowrap font-mono text-[13px]">
                  {c.kevDate ? (
                    <>
                      {fmtDayYear(c.kevDate)}
                      {c.leadDays !== null ? <div className="text-xs text-muted">{plural(c.leadDays, "day")} later</div> : null}
                    </>
                  ) : (
                    <span className="text-muted">Not listed</span>
                  )}
                </td>
                <td>
                  <span className={`inline-block whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.08em] ${OUTCOME[c.outcome].cls}`}>{OUTCOME[c.outcome].label}</span>
                  {c.outcome === "pending" && c.settlesOn ? <div className="font-mono text-xs text-muted">settles {fmtDayYear(c.settlesOn)}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function TrackRecordPage() {
  const data = await cachedTrackRecord().catch(() => null);
  const versions = data?.versions ?? versionRows(await latestReports());
  const live = data?.live.actNow.byVersion ?? {};
  return (
    <ProsePage
      title="Track record"
      intro="How often our early Act now calls turned out right. The live record counts every call the site has made. The backtest replays each rules version over 18 months of history. Both include their misses."
      badge={null}
      footer={`RULES ${(data?.rulesVersion ?? versions.find((v) => v.active)?.version ?? "").toUpperCase()} ACTIVE · JSON AT /API/V1/TRACK-RECORD`}
    >
      <section id="what-right-means">
        <h2>What right means</h2>
        <p>
          An early Act now is <strong>right</strong> when CISA or VulnCheck lists the flaw as exploited within {ACT_NOW_HORIZON_DAYS} days of our call. It is <strong>wrong</strong> when{" "}
          {ACT_NOW_HORIZON_DAYS} days pass with no listing. Until then it is <strong>pending</strong>. Calls made after a listing are not scored, because they cannot be wrong.
        </p>
        <p>KEV is a strict test. Some flaws are exploited and never listed, so the real rate is likely higher than what we show. We count each flaw once, from the first time the site rated it Act now. A flaw that joins a group of listed flaws never borrows the group&apos;s earlier call.</p>
      </section>

      {data ? (
        <LiveSection data={data} />
      ) : (
        <section id="live">
          <h2>Live record</h2>
          <p className="rounded-sm border border-line bg-surface px-4 py-5 text-fg">The live record is not available right now. The backtest below does not depend on it.</p>
        </section>
      )}

      <section id="by-version">
        <h2>By rules version</h2>
        <p>
          The bar spans the range the true rate likely falls in (a 95% interval). The mark is the measured rate. Backtest rates are weighted to the full population of CVEs. How the backtest works and its
          limits are in the <Link href="/methodology#verdict-rules-and-the-backtest">methodology</Link>.
        </p>
        <ol aria-label="Rules versions, newest first" className="!m-0 !flex !list-none !flex-col !gap-3 !p-0">
          {versions.map((v) => (
            <VersionCard key={v.version} v={v} live={live[v.version]} />
          ))}
        </ol>
      </section>

      {data ? <CallsTable data={data} /> : null}

      <section id="for-agents">
        <h2>For agents</h2>
        <p>
          The same numbers, with every call, are JSON at <a href="/api/v1/track-record">/api/v1/track-record</a>. The rules and their history are on the <Link href="/methodology#rules-changelog">methodology page</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
