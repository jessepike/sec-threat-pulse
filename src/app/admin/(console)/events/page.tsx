import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { listEvents } from "@/lib/admin/queries";
import { LadderCells } from "../../_components/ladder";
import { Flash, NoDb, PageHead, VerdictPill, fmt, one, type SP } from "../../_components/ui";

export const metadata = { title: "Events" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q);
  const verdict = one(sp.verdict);
  const hidden = one(sp.hidden);
  const db = getDb();
  const rows = db
    ? await listEvents(db, { q, verdict: verdict || undefined, hidden: hidden === "yes" ? true : hidden === "no" ? false : undefined })
    : null;
  return (
    <>
      <PageHead title="Events" sub="Up to 100 most recently updated." />
      <Flash sp={sp} />
      {!rows ? (
        <NoDb />
      ) : (
        <>
          <form method="get" className="adm-card adm-bar adm-inline">
            <input name="q" defaultValue={q} placeholder="Search title or id" aria-label="Search" />
            <select name="verdict" defaultValue={verdict} aria-label="Verdict">
              <option value="">Any verdict</option>
              <option value="act_now">Act now</option>
              <option value="watch">Watch</option>
              <option value="low">Low</option>
            </select>
            <select name="hidden" defaultValue={hidden} aria-label="Hidden">
              <option value="">Hidden or not</option>
              <option value="no">Visible only</option>
              <option value="yes">Hidden only</option>
            </select>
            <button className="adm-btn" type="submit">Filter</button>
          </form>
          <div className="adm-card adm-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Event</th><th>Ladder</th><th>Verdict</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/admin/events/${encodeURIComponent(e.id)}`}>{e.titleOverride ?? e.title}</Link>
                      <div className="adm-mono adm-muted">{e.id}{e.hidden ? " · hidden" : ""}</div>
                    </td>
                    <td><LadderCells ladder={e.ladder} /></td>
                    <td>
                      <VerdictPill verdict={e.overrideVerdict ?? e.verdict} />
                      {e.overrideVerdict ? <span className="adm-muted adm-small"> override</span> : null}
                    </td>
                    <td className="adm-mono">{fmt(e.updatedAt)}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={4} className="adm-muted">No events match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
