import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { headlineRows, latestReports, revealLog } from "@/lib/admin/backtest";
import { CURRENT_RULES_VERSION, RULES } from "@/lib/ladder/rules";
import { RULES_CHANGELOG } from "@/lib/ladder/rules/changelog";
import { Empty, PageHead, fmt } from "../../_components/ui";

export const metadata = { title: "Rules" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await requireAdmin();
  const [reports, reveals] = await Promise.all([latestReports(), revealLog()]);
  const versions = Object.keys(RULES).sort().reverse();
  const summaryOf = new Map(RULES_CHANGELOG.map((c) => [c.version, c]));

  return (
    <>
      <PageHead title="Rules" sub="Verdict rule versions and the backtest behind each. Read only. Rules change by shipping a new version in code." />

      <section className="adm-card">
        <h2>Active version</h2>
        <p>
          <span className="adm-pill adm-pill-low">{CURRENT_RULES_VERSION}</span>{" "}
          <span className="adm-muted">New and rebuilt events use this version. The public explanation is on </span>
          <Link href="/methodology">/methodology</Link>
          <span className="adm-muted">.</span>
        </p>
      </section>

      <section className="adm-card adm-scroll">
        <h2>Versions</h2>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Released</th>
              <th>What it does</th>
              <th>What the backtest found</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const c = summaryOf.get(v);
              return (
                <tr key={v}>
                  <td className="adm-mono">
                    {v} {v === CURRENT_RULES_VERSION ? <span className="adm-pill adm-pill-low">active</span> : null}
                  </td>
                  <td className="adm-mono">{c?.date ?? "n/a"}</td>
                  <td>{c?.summary ?? "No summary written."}</td>
                  <td>{c?.finding ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Latest backtest per version</h2>
        <p className="adm-muted adm-small">
          Population weighted rates with 95% intervals, then hits over calls. Tuning is Apr 2025 to Mar 2026. Held out is Apr to Oct 2026. Reports are files in reports/backtest/, so this page shows what is committed.
        </p>
        {versions.map((v) => {
          const r = reports[v];
          if (!r) {
            return (
              <div key={v} className="adm-card">
                <h3>{v}</h3>
                <Empty>No report file found for {v}.</Empty>
              </div>
            );
          }
          return (
            <details key={v} className="adm-card" open={v === CURRENT_RULES_VERSION}>
              <summary>
                <strong className="adm-mono">{v}</strong>{" "}
                <span className="adm-muted adm-small">
                  run {fmt(r.ranAt)} · window {r.window?.from} to {r.window?.to} · {r.dataset.cves.toLocaleString("en-US")} CVEs · {r.file}
                </span>
              </summary>
              <div className="adm-scroll">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th>Tuning</th>
                      <th>Held out</th>
                      <th>Whole window</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headlineRows(r).map((row) => (
                      <tr key={row.label}>
                        <td>
                          {row.label}
                          {row.note ? <div className="adm-muted adm-small">{row.note}</div> : null}
                        </td>
                        <td className="adm-mono">{row.cells.tuning}</td>
                        <td className="adm-mono">{row.cells["held-out"]}</td>
                        <td className="adm-mono">{row.cells.all}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </section>

      <section className="adm-card adm-scroll">
        <h2>Held out reveal log</h2>
        <p className="adm-muted adm-small">
          Held out results stay hidden while rules are tuned. Every run that shows them is logged in reports/backtest/heldout-reveals.log. Do not tune on these numbers.
        </p>
        {reveals === null ? (
          <Empty>The reveal log could not be read.</Empty>
        ) : reveals.length === 0 ? (
          <Empty>No reveals yet.</Empty>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Rules</th>
                <th>Purpose</th>
                <th>Dataset</th>
                <th>Arguments</th>
              </tr>
            </thead>
            <tbody>
              {reveals.map((e, i) => (
                <tr key={i}>
                  <td className="adm-mono">{e.at}</td>
                  <td className="adm-mono">{e.rules}</td>
                  <td>{e.purpose}</td>
                  <td className="adm-mono adm-small">{e.dataset}</td>
                  <td className="adm-mono adm-small">{e.args}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
