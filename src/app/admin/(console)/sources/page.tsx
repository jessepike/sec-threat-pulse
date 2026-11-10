import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import Link from "next/link";
import { listSourcesByHealth } from "@/lib/admin/queries";
import type { SourceState } from "@/lib/admin/attention";
import { runSourceAction, setSourceInterval, toggleSource } from "../../actions";
import { ConfirmButton } from "../../_components/ConfirmButton";
import { Ago, Flash, NoDb, PageHead, type SP } from "../../_components/ui";

export const metadata = { title: "Sources" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

const STATE_CLASS: Record<SourceState, string> = { failing: "adm-pill-act", stale: "adm-pill-act", error: "adm-pill-watch", ok: "adm-pill-low", new: "", off: "" };
const STATE_TEXT: Record<SourceState, string> = { failing: "failing", stale: "stale", error: "last run failed", ok: "ok", new: "not run yet", off: "off" };

const every = (min: number) => (min % 1440 === 0 ? `${min / 1440} d` : min % 60 === 0 ? `${min / 60} h` : `${min} min`);

export default async function SourcesPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const now = new Date();
  const rows = db ? await listSourcesByHealth(db, now) : null;
  const attention = rows ? rows.filter((r) => r.state === "failing" || r.state === "stale" || r.state === "error").length : 0;
  return (
    <>
      <PageHead title="Sources" sub={rows ? `${rows.length} sources, the ${attention === 1 ? "one that needs" : "ones that need"} a look first (${attention}). Changes are audited.` : "Every source in the registry. Changes are audited."} />
      <Flash sp={sp} />
      {!rows ? (
        <NoDb />
      ) : (
        <div className="adm-card adm-scroll" tabIndex={0} role="region" aria-label="Sources table">
          <table className="adm-table adm-stack">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Last success</th>
                <th>Last run</th>
                <th>Runs every</th>
                <th><span className="adm-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>{s.name}</div>
                    <div className="adm-mono adm-muted">{s.id}</div>
                  </td>
                  <td data-label="Status">
                    <div>
                      <span className={`adm-pill ${STATE_CLASS[s.state]}`}>{STATE_TEXT[s.state]}</span>
                      {s.state === "failing" || s.state === "stale" || s.state === "error" ? (
                        <Link href={`/admin/runs?source=${encodeURIComponent(s.id)}`} className="adm-small adm-nowrap">Runs</Link>
                      ) : null}
                      {s.enabled && (s.reason || s.lastError) ? <div className="adm-errtext">{s.reason || s.lastError?.slice(0, 300)}</div> : null}
                    </div>
                  </td>
                  <td data-label="Last success"><Ago d={s.lastSuccessAt} now={now} /></td>
                  <td data-label="Last run"><Ago d={s.lastRunAt} now={now} /></td>
                  <td data-label="Runs every" className="adm-nowrap">{every(s.intervalMinutes)}</td>
                  <td>
                    <div className="adm-actions">
                      <form action={runSourceAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="from" value="sources" />
                        <button className="adm-btn" type="submit" aria-label={`Run ${s.name} now`}>Run now</button>
                      </form>
                      <details className="adm-rowmenu">
                        <summary className="adm-btn" aria-label={`More for ${s.name}`}>More</summary>
                        <div className="adm-rowmenu-body">
                          <form action={setSourceInterval} className="adm-inline">
                            <input type="hidden" name="id" value={s.id} />
                            <label className="adm-small adm-muted" htmlFor={`int-${s.id}`}>Minutes between runs</label>
                            <input id={`int-${s.id}`} name="minutes" type="number" min={5} max={10080} defaultValue={s.intervalMinutes} className="adm-num" />
                            <button className="adm-btn" type="submit">Set</button>
                          </form>
                          <form action={toggleSource}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="enabled" value={String(!s.enabled)} />
                            {s.enabled ? <ConfirmButton className="adm-btn" message={`Disable ${s.name}? It stops updating until you enable it again.`}>Disable</ConfirmButton> : <button className="adm-btn" type="submit">Enable</button>}
                          </form>
                          <span className="adm-small adm-muted">Terms: {s.termsStatus}</span>
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="adm-muted">No sources registered yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
