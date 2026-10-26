import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { overviewData } from "@/lib/admin/queries";
import { Empty, NoDb, PageHead, StatusPill, VerdictPill, fmt } from "../_components/ui";

export const metadata = { title: "Overview" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireAdmin();
  const db = getDb();
  if (!db) {
    return (
      <>
        <PageHead title="Overview" />
        <NoDb />
      </>
    );
  }
  const d = await overviewData(db);
  const counts = Object.fromEntries(d.verdicts.map((v) => [v.verdict, v.n]));
  return (
    <>
      <PageHead title="Overview" sub="Pipeline health and event counts." />
      <section className="adm-grid">
        <div className="adm-card">
          <h2>Last ingest run</h2>
          {d.lastRun ? (
            <p>
              <span className="adm-mono">{d.lastRun.sourceId}</span> <StatusPill status={d.lastRun.status} />
              <br />
              <span className="adm-muted">
                {fmt(d.lastRun.startedAt)} · {d.lastRun.itemsNew} new items
              </span>
            </p>
          ) : (
            <Empty>No runs yet.</Empty>
          )}
        </div>
        <div className="adm-card">
          <h2>Sources failing</h2>
          <p className="adm-big">{d.failing.length}</p>
          {d.failing.slice(0, 4).map((s) => (
            <p key={s.id} className="adm-small">
              <span className="adm-mono">{s.id}</span> <span className="adm-muted">{s.lastError?.slice(0, 80)}</span>
            </p>
          ))}
        </div>
        <div className="adm-card">
          <h2>Open alerts</h2>
          <p className="adm-big">{d.alerts.length}</p>
          {d.alerts.slice(0, 4).map((a) => (
            <p key={a.sourceId} className="adm-small">
              <span className="adm-mono">{a.sourceId}</span> <span className="adm-muted">{a.reason}</span>
            </p>
          ))}
          {d.dbBytes !== null && (
            <p className="adm-small adm-muted">Database: {Math.round(d.dbBytes / 1024 / 1024)} MB of 512 MB (Neon free plan)</p>
          )}
        </div>
      </section>

      <section className="adm-card">
        <h2>Events by verdict</h2>
        <div className="adm-counts">
          {(["act_now", "watch", "low"] as const).map((v) => (
            <div key={v} className="adm-count">
              <VerdictPill verdict={v} />
              <span className="adm-big">{counts[v] ?? 0}</span>
            </div>
          ))}
          <div className="adm-count">
            <span className="adm-pill">Hidden</span>
            <span className="adm-big">{d.hidden}</span>
          </div>
        </div>
      </section>

      <section className="adm-card">
        <h2>Recent audit entries</h2>
        {d.recent.length === 0 ? (
          <Empty>No admin actions yet.</Empty>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.id}>
                  <td className="adm-mono">{fmt(r.at)}</td>
                  <td>{r.actor}</td>
                  <td className="adm-mono">{r.action}</td>
                  <td className="adm-mono">{r.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
