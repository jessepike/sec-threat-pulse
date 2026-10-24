import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { listAudit } from "@/lib/admin/queries";
import { NoDb, PageHead, fmt, one, type SP } from "../../_components/ui";

export const metadata = { title: "Audit" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const actor = one(sp.actor);
  const db = getDb();
  const rows = db ? await listAudit(db, actor || undefined) : null;
  return (
    <>
      <PageHead title="Audit log" sub="Every admin action. Read only. Latest 300." />
      {!rows ? (
        <NoDb />
      ) : (
        <div className="adm-card adm-scroll">
          <table className="adm-table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-mono">{fmt(r.at)}</td>
                  <td>{r.actor}</td>
                  <td className="adm-mono">{r.action}</td>
                  <td className="adm-mono">{r.target}</td>
                  <td className="adm-mono adm-small">{r.details ? JSON.stringify(r.details).slice(0, 200) : ""}</td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5} className="adm-muted">No entries yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
