import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { listCorrections } from "@/lib/admin/queries";
import { addCorrectionAction } from "../../actions";
import { Flash, NoDb, PageHead, fmt, type SP } from "../../_components/ui";

export const metadata = { title: "Corrections" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function CorrectionsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const rows = db ? await listCorrections(db) : null;
  return (
    <>
      <PageHead title="Corrections" sub="Public corrections log. Entries are append-only." />
      <Flash sp={sp} />
      {!rows ? (
        <NoDb />
      ) : (
        <>
          <section className="adm-card">
            <h2>Add a correction</h2>
            <form action={addCorrectionAction} className="adm-form">
              <label>
                Event id (optional)
                <input name="eventId" />
              </label>
              <label>
                What changed and why
                <textarea name="text" rows={4} required minLength={10} maxLength={2000} />
              </label>
              <button className="adm-btn adm-btn-primary" type="submit">Add correction</button>
            </form>
          </section>
          <section className="adm-card adm-scroll">
            <table className="adm-table">
              <thead><tr><th>When</th><th>Event</th><th>Text</th><th>By</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="adm-mono">{fmt(c.createdAt)}</td>
                    <td className="adm-mono">{c.eventId}</td>
                    <td>{c.text}</td>
                    <td>{c.actor}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={4} className="adm-muted">No corrections yet.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
