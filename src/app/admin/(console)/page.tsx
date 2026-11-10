import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import Link from "next/link";
import { overviewData } from "@/lib/admin/queries";
import { attentionItems } from "@/lib/admin/attention";
import { DB_LIMIT_BYTES } from "@/lib/ingest/health";
import { Ago, Empty, NoDb, PageHead, StatusPill, VerdictPill, fmt } from "../_components/ui";

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
  const items = attentionItems(d);
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  return (
    <>
      <PageHead title="Overview" sub="What needs you first, then the state of the pipeline." />
      <section className="adm-card" aria-labelledby="inbox">
        <h2 id="inbox">Needs attention ({items.length})</h2>
        {items.length === 0 ? (
          <Empty>Nothing needs you. No alerts are open, no source failed its last run and no draft is waiting.</Empty>
        ) : (
          <ul className="adm-inbox">
            {items.map((i) => (
              <li key={i.key}>
                <span className="adm-inbox-text">
                  <span className={`adm-pill adm-pill-${i.tone}`}>{i.label}</span> {i.text}
                </span>
                {i.href ? (
                  <Link href={i.href} className="adm-nowrap">
                    {i.action}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="adm-grid">
        <div className="adm-card">
          <h2>Last complete run</h2>
          <p className="adm-big">
            <Ago d={d.lastCompleteAt} />
          </p>
          <p className="adm-small adm-muted">Ingest and the event builder both finished. Readers see DELAYED after an hour without one.</p>
        </div>
        <div className="adm-card">
          <h2>Last source run</h2>
          {d.lastRun ? (
            <p>
              <Link href={`/admin/runs?source=${encodeURIComponent(d.lastRun.sourceId)}`} className="adm-mono">
                {d.lastRun.sourceId}
              </Link>{" "}
              <StatusPill status={d.lastRun.status} />
              <br />
              <span className="adm-muted">
                <Ago d={d.lastRun.startedAt} /> · {d.lastRun.itemsNew} new items
              </span>
            </p>
          ) : (
            <Empty>No runs yet.</Empty>
          )}
        </div>
        <div className="adm-card">
          <h2>Database</h2>
          {d.dbBytes === null ? (
            <Empty>Size not available.</Empty>
          ) : (
            <>
              <p className="adm-big">{Math.round((d.dbBytes / DB_LIMIT_BYTES) * 100)}%</p>
              <p className="adm-small adm-muted">
                {mb(d.dbBytes)} MB of {mb(DB_LIMIT_BYTES)} MB on the Neon free plan. An alert opens at 80%.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="adm-card">
        <h2>Events by verdict</h2>
        <div className="adm-counts">
          {(["act_now", "watch", "low"] as const).map((v) => (
            <Link key={v} href={`/admin/events?verdict=${v}&hidden=no`} className="adm-count">
              <VerdictPill verdict={v} />
              <span className="adm-big">{counts[v] ?? 0}</span>
            </Link>
          ))}
          <Link href="/admin/events?hidden=yes" className="adm-count">
            <span className="adm-pill">Hidden</span>
            <span className="adm-big">{d.hidden}</span>
          </Link>
        </div>
      </section>

      <section className="adm-card">
        <h2>Recent audit entries</h2>
        {d.recent.length === 0 ? (
          <Empty>No admin actions yet.</Empty>
        ) : (
          <table className="adm-table adm-stack">
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
                  <td className="adm-mono" data-label="When">{fmt(r.at)}</td>
                  <td data-label="Who">{r.actor}</td>
                  <td className="adm-mono" data-label="Action">{r.action}</td>
                  <td className="adm-mono" data-label="Target">{r.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
