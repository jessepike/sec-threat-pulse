import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { listRuns, listSources } from "@/lib/admin/queries";
import { runSourceAction } from "../../actions";
import { Flash, NoDb, PageHead, StatusPill, fmt, one, type SP } from "../../_components/ui";

export const metadata = { title: "Runs" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function RunsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const source = one(sp.source);
  const status = one(sp.status);
  const [runs, sources] = db ? await Promise.all([listRuns(db, { sourceId: source || undefined, status: status || undefined }), listSources(db)]) : [null, null];
  return (
    <>
      <PageHead title="Runs" sub="Ingest history, newest first. Shows up to 200." />
      <Flash sp={sp} />
      {!runs || !sources ? (
        <NoDb />
      ) : (
        <>
          <div className="adm-card adm-bar">
            <form method="get" className="adm-inline">
              <select name="source" defaultValue={source} aria-label="Source">
                <option value="">All sources</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
              <select name="status" defaultValue={status} aria-label="Status">
                <option value="">Any status</option>
                <option value="ok">ok</option>
                <option value="error">error</option>
                <option value="running">running</option>
              </select>
              <button className="adm-btn" type="submit">Filter</button>
            </form>
            <form action={runSourceAction} className="adm-inline">
              <input type="hidden" name="from" value="runs" />
              <select name="id" aria-label="Source to run" required defaultValue="">
                <option value="" disabled>Choose a source</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
              <button className="adm-btn adm-btn-primary" type="submit">Run now</button>
            </form>
          </div>
          <div className="adm-card adm-scroll" tabIndex={0} role="region" aria-label="Runs table">
            <table className="adm-table adm-stack">
              <thead>
                <tr><th>Started</th><th>Source</th><th>Status</th><th>Fetched</th><th>New</th><th>Finished</th><th>Error</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="adm-mono" data-label="Started">{fmt(r.startedAt)}</td>
                    <td className="adm-mono" data-label="Source">{r.sourceId}</td>
                    <td data-label="Status"><StatusPill status={r.status} /></td>
                    <td data-label="Fetched">{r.itemsFetched}</td>
                    <td data-label="New">{r.itemsNew}</td>
                    <td className="adm-mono" data-label="Finished">{fmt(r.finishedAt)}</td>
                    <td className="adm-small adm-err" data-label="Error">{r.error?.slice(0, 160)}</td>
                  </tr>
                ))}
                {runs.length === 0 ? <tr><td colSpan={7} className="adm-muted">No runs match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
