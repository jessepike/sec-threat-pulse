import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { ADMIN_EVENTS_PAGE_SIZE, listEvents } from "@/lib/admin/queries";
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
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));
  const found = db
    ? await listEvents(db, { q, verdict: verdict || undefined, hidden: hidden === "yes" ? true : hidden === "no" ? false : undefined, page })
    : null;
  const rows = found?.rows ?? null;
  const pages = found ? Math.max(1, Math.ceil(found.total / ADMIN_EVENTS_PAGE_SIZE)) : 1;
  const pageHref = (n: number) => `/admin/events?${new URLSearchParams({ ...(q ? { q } : {}), ...(verdict ? { verdict } : {}), ...(hidden ? { hidden } : {}), page: String(n) })}`;
  return (
    <>
      <PageHead title="Events" sub={found ? `${found.total} events, most recently updated first.` : "Most recently updated first."} />
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
          <div className="adm-card adm-scroll" tabIndex={0} role="region" aria-label="Events table">
            <table className="adm-table">
              <thead>
                <tr><th>Event</th><th>Ladder</th><th>Verdict</th><th>Updated</th><th>Public page</th></tr>
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
                      {e.tier === "today" && (e.overrideVerdict ?? e.verdict) === "act_now" ? <span className="adm-pill adm-pill-act">Today</span> : null}
                      {e.overrideVerdict ? <span className="adm-muted adm-small"> override</span> : null}
                    </td>
                    <td className="adm-mono">{fmt(e.updatedAt)}</td>
                    <td>{e.hidden ? <span className="adm-muted">hidden</span> : <a href={`/events/${encodeURIComponent(e.id)}`} target="_blank" rel="noopener noreferrer">View</a>}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={5} className="adm-muted">No events match.</td></tr> : null}
              </tbody>
            </table>
          </div>
          {pages > 1 ? (
            <nav aria-label="Pages" className="adm-inline">
              {page > 1 ? <Link className="adm-btn" href={pageHref(page - 1)}>Previous</Link> : null}
              <span className="adm-muted">Page {Math.min(page, pages)} of {pages}</span>
              {page < pages ? <Link className="adm-btn" href={pageHref(page + 1)}>Next</Link> : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
