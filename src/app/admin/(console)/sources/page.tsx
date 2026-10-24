import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { listSources } from "@/lib/admin/queries";
import { runSourceAction, setSourceInterval, toggleSource } from "../../actions";
import { Flash, NoDb, PageHead, StatusPill, fmt, type SP } from "../../_components/ui";

export const metadata = { title: "Sources" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const instant = false;

export default async function SourcesPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const rows = db ? await listSources(db) : null;
  return (
    <>
      <PageHead title="Sources" sub="Every source in the registry. Changes are audited." />
      <Flash sp={sp} />
      {!rows ? (
        <NoDb />
      ) : (
        <div className="adm-card adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Last run</th>
                <th>Last success</th>
                <th>Last error</th>
                <th>Interval (min)</th>
                <th>Terms</th>
                <th>Enabled</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>{s.name}</div>
                    <div className="adm-mono adm-muted">{s.id}</div>
                  </td>
                  <td>{!s.enabled ? <span className="adm-pill">off</span> : <StatusPill status={s.lastError ? "error" : s.lastRunAt ? "ok" : "new"} />}</td>
                  <td className="adm-mono">{fmt(s.lastRunAt)}</td>
                  <td className="adm-mono">{fmt(s.lastSuccessAt)}</td>
                  <td className="adm-small adm-err">{s.lastError?.slice(0, 120)}</td>
                  <td>
                    <form action={setSourceInterval} className="adm-inline">
                      <input type="hidden" name="id" value={s.id} />
                      <input name="minutes" type="number" min={5} max={10080} defaultValue={s.intervalMinutes} className="adm-num" aria-label={`Interval for ${s.id}`} />
                      <button className="adm-btn" type="submit">Set</button>
                    </form>
                  </td>
                  <td><span className="adm-pill">{s.termsStatus}</span></td>
                  <td>
                    <form action={toggleSource}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="enabled" value={String(!s.enabled)} />
                      <button className="adm-btn" type="submit">{s.enabled ? "Disable" : "Enable"}</button>
                    </form>
                  </td>
                  <td>
                    <form action={runSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="from" value="sources" />
                      <button className="adm-btn" type="submit">Run now</button>
                    </form>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="adm-muted">No sources registered yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
