import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { fmtCell, latestReports, period, pct } from "@/lib/admin/backtest";
import { freshness, kevCoverage, trust } from "@/lib/admin/scorecard";
import { CURRENT_RULES_VERSION, getRules } from "@/lib/ladder/rules";
import { listIssues } from "@/lib/admin/github";
import { getTrackRecord } from "@/lib/track-record";
import { Empty, NoDb, PageHead, fmt } from "../../_components/ui";

export const metadata = { title: "Scorecard" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

type Status = "meets" | "below" | "unknown";
const STATUS_CLASS: Record<Status, string> = { meets: "low", below: "act", unknown: "watch" };
const STATUS_TEXT: Record<Status, string> = { meets: "meets target", below: "below target", unknown: "not measured" };

function Pill({ s }: { s: Status }) {
  return <span className={`adm-pill adm-pill-${STATUS_CLASS[s]}`} style={{ whiteSpace: "nowrap" }}>{STATUS_TEXT[s]}</span>;
}

/** The scorecard line from intent.md, so this page and the intent stay in step. */
async function intentScorecard(): Promise<string | null> {
  try {
    const md = await readFile(path.join(process.cwd(), "intent.md"), "utf8");
    const m = /## Scorecard\s+([\s\S]*?)\n\s*\n/.exec(md);
    return m ? m[1].replace(/\s+/g, " ").trim() : null;
  } catch {
    return null;
  }
}

const age = (d: Date | null, now: Date) => {
  if (!d) return "never";
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  return mins < 90 ? `${mins} min` : mins < 2880 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
};

export default async function ScorecardPage() {
  await requireAdmin();
  const now = new Date();
  const db = getDb();
  const token = process.env.GITHUB_TOKEN;
  const [reports, intentLine, record, issues] = await Promise.all([
    latestReports(),
    intentScorecard(),
    getTrackRecord(now).catch(() => null),
    token ? listIssues(token) : Promise.resolve(null),
  ]);
  // The nightly agent test set keeps one open alert issue while any question fails.
  const agentAlert = issues && issues.ok ? issues.issues.find((i) => i.labels.includes("alert") && /agent test set/i.test(i.title)) : undefined;
  const agentStatus: Status = !issues || !issues.ok ? "unknown" : agentAlert ? "below" : "meets";
  const liveCalls = record?.live.actNow.overall;
  // A version that only adds a tier or a score keeps the verdicts, so its predecessor's backtest report applies.
  const reportVersion = reports[CURRENT_RULES_VERSION] ? CURRENT_RULES_VERSION : (getRules(CURRENT_RULES_VERSION).verdictsFrom ?? CURRENT_RULES_VERSION);
  const report = reports[reportVersion];
  const all = period(report, "all");
  const held = period(report, "held-out");
  const live = db ? { fresh: await freshness(db, now, 7), cov: await kevCoverage(db, now, 30), trust: await trust(db, now) } : null;

  const accuracy = all?.actNow.preConfirmation;
  const accuracyRate = accuracy?.weightedRate ?? accuracy?.rate;
  const covRate = live && live.cov.kevAdditions ? live.cov.withEvent / live.cov.kevAdditions : undefined;
  const urlRate = live && live.trust.observations ? live.trust.withUrl / live.trust.observations : undefined;
  const freshStatus: Status = !live ? "unknown" : live.fresh.pipelineRunsPerDay >= 4 ? "meets" : "below";

  return (
    <>
      <PageHead title="Scorecard" sub="The eight measures from intent.md. Values come from the database where they can be computed, and from the backtest reports for accuracy and lead time." />
      {intentLine ? <p className="adm-muted adm-small">{intentLine}</p> : null}

      <section className="adm-card adm-scroll">
        <table className="adm-table adm-stack">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Target</th>
              <th>Current</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Accuracy</td>
              <td>Early Act now right 80% of the time (open decision)</td>
              <td>
                <span className="adm-mono">{fmtCell(accuracy)}</span>
                <div className="adm-muted adm-small">
                  Rules {reportVersion}{reportVersion !== CURRENT_RULES_VERSION ? ` (verdicts of ${CURRENT_RULES_VERSION})` : ""}, whole window, Act now before confirmation, right within 30 days. Held out: <span className="adm-mono">{fmtCell(held?.actNow.preConfirmation)}</span>
                </div>
                <div className="adm-muted adm-small">
                  Live since {record ? record.live.since : "n/a"}:{" "}
                  {liveCalls ? `${liveCalls.calls} early Act now calls, ${liveCalls.right} right, ${liveCalls.wrong} wrong, ${liveCalls.pending} pending.` : "no live record available."}{" "}
                  <a href="/track-record" target="_blank" rel="noopener noreferrer">Track record</a>
                </div>
              </td>
              <td>
                <Pill s={accuracyRate === undefined ? "unknown" : accuracyRate >= 0.8 ? "meets" : "below"} />
              </td>
            </tr>
            <tr>
              <td>Lead time</td>
              <td>No target set</td>
              <td>
                <span className="adm-mono">{all?.leadTime.medianPreKev === undefined ? "n/a" : `${all.leadTime.medianPreKev} days median`}</span>
                <div className="adm-muted adm-small">
                  Over the {all ? pct(all.leadTime.shareBeforeKev.rate, 0) : "n/a"} of KEV additions that got an Act now before the listing day. Across all KEV additions the median is {all?.leadTime.medianAll ?? "n/a"}.
                </div>
              </td>
              <td><Pill s="unknown" /></td>
            </tr>
            <tr>
              <td>Freshness</td>
              <td>4 or more runs a day</td>
              <td>
                {live ? (
                  <>
                    <span className="adm-mono">{live.fresh.pipelineRunsPerDay.toFixed(1)} successful runs a day</span>
                    <div className="adm-muted adm-small">All sources together, last 7 days. Per source below.</div>
                  </>
                ) : (
                  <span className="adm-muted">Database not connected</span>
                )}
              </td>
              <td><Pill s={freshStatus} /></td>
            </tr>
            <tr>
              <td>Coverage</td>
              <td>95% or more of KEV additions</td>
              <td>
                {live ? (
                  <>
                    <span className="adm-mono">{covRate === undefined ? "n/a" : pct(covRate)}</span>
                    <div className="adm-muted adm-small">
                      {live.cov.withEvent} of {live.cov.kevAdditions} KEV additions in the last 30 days have a visible event.
                    </div>
                  </>
                ) : (
                  <span className="adm-muted">Database not connected</span>
                )}
              </td>
              <td><Pill s={covRate === undefined ? "unknown" : covRate >= 0.95 ? "meets" : "below"} /></td>
            </tr>
            <tr>
              <td>Clarity</td>
              <td>A non-technical reader gets the verdict and action in 30 seconds</td>
              <td className="adm-muted">Not measured. Needs a timed test with readers; none has been run.</td>
              <td><Pill s="unknown" /></td>
            </tr>
            <tr>
              <td>Trust</td>
              <td>100% sourced, rules public, corrections within 24 hours</td>
              <td>
                {live ? (
                  <>
                    <span className="adm-mono">{urlRate === undefined ? "n/a" : `${pct(urlRate)} of observations have a source link`}</span>
                    <div className="adm-muted adm-small">
                      {live.trust.withUrl} of {live.trust.observations}. Rules are public on /methodology. Corrections logged: {live.trust.correctionsTotal} in total, {live.trust.corrections30d} in the last 30 days. Time to correct is not recorded yet.
                    </div>
                  </>
                ) : (
                  <span className="adm-muted">Database not connected. Rules are public on /methodology.</span>
                )}
              </td>
              <td><Pill s={urlRate === undefined ? "unknown" : urlRate >= 1 ? "meets" : "below"} /></td>
            </tr>
            <tr>
              <td>Agent readiness</td>
              <td>API, feeds, llms.txt and MCP</td>
              <td>
                <span className="adm-mono">Live: API v1 with OpenAPI, feeds, llms.txt, MCP server</span>
                <div className="adm-muted adm-small">
                  {agentStatus === "unknown"
                    ? "The nightly agent test set reports through an alert issue. GITHUB_TOKEN is not set here, so its state is not read."
                    : agentAlert
                      ? <>The nightly agent test set is failing: <a href={agentAlert.url} target="_blank" rel="noopener noreferrer">{agentAlert.title}</a></>
                      : "The nightly agent test set has no open alert, so every question passed on its last run."}
                </div>
              </td>
              <td><Pill s={agentStatus} /></td>
            </tr>
            <tr>
              <td>Running cost</td>
              <td>Under $50 a month</td>
              <td className="adm-muted">Not measured. No cost feed is connected. The database storage share is on the Overview.</td>
              <td><Pill s="unknown" /></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Freshness by source, last 7 days</h2>
        {!live ? (
          <NoDb />
        ) : (
          <div className="adm-card adm-scroll">
            <table className="adm-table adm-stack">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Interval</th>
                  <th>OK runs</th>
                  <th>Errors</th>
                  <th>Runs a day</th>
                  <th>Last success</th>
                  <th>Newest data stored</th>
                </tr>
              </thead>
              <tbody>
                {live.fresh.rows.map((r) => (
                  <tr key={r.sourceId}>
                    <td className="adm-mono">
                      {r.sourceId}
                      {r.enabled ? "" : " (off)"}
                    </td>
                    <td className="adm-mono" data-label="Interval">{r.intervalMinutes} min</td>
                    <td className="adm-mono" data-label="OK runs">{r.okRuns}</td>
                    <td className="adm-mono" data-label="Errors">{r.errorRuns}</td>
                    <td className="adm-mono" data-label="Runs a day">{r.runsPerDay.toFixed(1)}</td>
                    <td className="adm-mono" data-label="Last success">{fmt(r.lastSuccessAt)}</td>
                    <td className="adm-mono" data-label="Newest data">{age(r.newestObservationAt, now)} old</td>
                  </tr>
                ))}
                {live.fresh.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <Empty>No sources are registered yet.</Empty>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
