import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { eventDetail } from "@/lib/admin/queries";
import { getNarrative } from "@/lib/narrative/store";
import { RATINGS, ROLE_KEYS } from "@/lib/narrative/model";
import { RUNGS, RUNG_LABELS } from "@/lib/ladder/types";
import {
  clearOverrideAction,
  saveNarrativeAction,
  unpublishNarrativeAction,
  mergeEventsAction,
  overrideVerdictAction,
  renameEventAction,
  setHiddenAction,
} from "../../../actions";
import { Empty, Flash, Fold, NoDb, PageHead, VerdictPill, fmt, type SP } from "../../../_components/ui";

export const metadata = { title: "Event" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireAdmin();
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const sp = await searchParams;
  const db = getDb();
  if (!db) {
    return (
      <>
        <PageHead title="Event" />
        <NoDb />
      </>
    );
  }
  const d = await eventDetail(db, id);
  if (!d) notFound();
  const e = d.event;
  const n = await getNarrative(db, id);
  const pad = <T,>(a: T[], size: number, fill: T) => [...a, ...Array.from({ length: Math.max(0, size - a.length) }, () => fill)];
  const claimRows = pad(n?.claimChecks ?? [], (n?.claimChecks.length ?? 0) + 2, { claim: "", truth: "", rating: "TRUE" as const });
  const effective = e.overrideVerdict ?? e.verdict;
  const here = `/admin/events/${encodeURIComponent(e.id)}`;
  const roleCount = n ? ROLE_KEYS.reduce((sum, r) => sum + (n.roles[r]?.length ?? 0), 0) : 0;
  const claimCount = n?.claimChecks.length ?? 0;
  return (
    <>
      <PageHead title={e.titleOverride ?? e.title} sub={`${e.id} · rules ${e.rulesVersion}`}>
        {e.hidden ? null : <a href={`/events/${encodeURIComponent(e.id)}`} target="_blank" rel="noopener noreferrer" className="adm-btn">View public page</a>}
        {n && !e.hidden ? <Link href={`${here}/preview`} className="adm-btn">Preview write-up</Link> : null}
        <Link href="/admin/events" className="adm-btn">Back to events</Link>
      </PageHead>
      <Flash sp={sp} />

      <section className="adm-grid">
        <div className="adm-card">
          <h2>Verdict</h2>
          <p><VerdictPill verdict={effective} /> {e.hidden ? <span className="adm-pill">hidden</span> : null}</p>
          <p className="adm-small adm-muted">Rules verdict: {e.verdict}. {e.verdictReason}</p>
          {e.overrideVerdict ? <p className="adm-small">Override reason: {e.overrideReason}</p> : null}
        </div>
        <div className="adm-card">
          <h2>Ladder</h2>
          <ul className="adm-rungs">
            {RUNGS.map((r) => (
              <li key={r}>
                <span className={`adm-rung adm-rung-${e.ladder[r] ?? "none"}`} /> {RUNG_LABELS[r]}
                <span className="adm-muted"> {e.ladder[r] ?? "none"}</span>
              </li>
            ))}
          </ul>
          <p className="adm-small adm-muted">Exploit maturity: {e.exploitMaturity}</p>
        </div>
        <div className="adm-card">
          <h2>CVEs</h2>
          {d.cves.length ? <p className="adm-mono adm-small">{d.cves.join(", ")}</p> : <Empty>None linked.</Empty>}
        </div>
      </section>

      <Fold title="Write-up" open hint={n ? `${n.status}, last saved ${fmt(n.updatedAt)} by ${n.updatedBy}${n.source === "ai_draft" ? ", drafted by an agent" : ""}` : "none yet"}>
        <p className="adm-small adm-muted">
          Readers see these sections only when the write-up is published. Save the draft, check it in the preview, then publish.
        </p>
        <form action={saveNarrativeAction} className="adm-form">
          <input type="hidden" name="id" value={e.id} />
          <label>
            Business exposure
            <textarea name="businessExposure" rows={3} maxLength={1200} defaultValue={n?.businessExposure ?? ""} />
          </label>
          <label>
            Why act before proof of damage
            <textarea name="whyAct" rows={3} maxLength={1200} defaultValue={n?.whyAct ?? ""} />
          </label>
          <label>
            The fix
            <textarea name="fix" rows={3} maxLength={1200} defaultValue={n?.fix ?? ""} />
          </label>
          <label>
            Ask your team (one question per line; the first shows in lists)
            <textarea name="askYourTeam" rows={3} maxLength={1200} defaultValue={n?.askYourTeam ?? ""} />
          </label>
          <details className="adm-fold" open={roleCount > 0}>
            <summary>
              <span>Actions by role</span>
              <span className="adm-hint adm-muted adm-small">{roleCount ? `${roleCount} written` : "none written"}</span>
            </summary>
            <div className="adm-form">
              {ROLE_KEYS.map((r) => {
                const items = pad(n?.roles[r] ?? [], (n?.roles[r]?.length ?? 0) + 2, "");
                return (
                  <fieldset key={r}>
                    <legend>{r.toUpperCase()}</legend>
                    {items.map((t, i) => (
                      <input key={i} name={`role_${r}`} defaultValue={t} maxLength={300} aria-label={`${r.toUpperCase()} action ${i + 1}`} />
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </details>
          <details className="adm-fold" open={claimCount > 0}>
            <summary>
              <span>Claim checks</span>
              <span className="adm-hint adm-muted adm-small">{claimCount ? `${claimCount} written` : "none written"}</span>
            </summary>
            <div className="adm-form">
              {claimRows.map((c, i) => (
                <fieldset key={i}>
                  <legend>Claim {i + 1}</legend>
                  <input name="claim_text" defaultValue={c.claim} maxLength={300} placeholder="What was claimed" aria-label={`Claim ${i + 1}`} />
                  <textarea name="claim_truth" rows={2} defaultValue={c.truth} maxLength={800} placeholder="What the evidence says" aria-label={`Evidence for claim ${i + 1}`} />
                  <select name="claim_rating" defaultValue={c.rating} aria-label={`Rating for claim ${i + 1}`}>
                    {RATINGS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </fieldset>
              ))}
            </div>
          </details>
          <p className="adm-small adm-muted">Empty rows are ignored. Save again to get more empty rows.</p>
          <div className="adm-inline">
            <button className="adm-btn" type="submit" name="intent" value="draft">Save draft</button>
            <button className="adm-btn adm-btn-primary" type="submit" name="intent" value="publish">Publish</button>
          </div>
        </form>
        {n?.status === "published" ? (
          <form action={unpublishNarrativeAction} className="adm-form adm-top">
            <input type="hidden" name="id" value={e.id} />
            <button className="adm-btn" type="submit">Unpublish</button>
          </form>
        ) : null}
      </Fold>

      <Fold title="Override the verdict" open={!!e.overrideVerdict} hint={e.overrideVerdict ? "an override is in force" : "the rules verdict is in force"}>
        <form action={overrideVerdictAction} className="adm-form">
          <input type="hidden" name="id" value={e.id} />
          <label>
            Verdict
            <select name="verdict" defaultValue={effective} required>
              <option value="act_now">Act now</option>
              <option value="watch">Watch</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            Reason (required, shown in the corrections log)
            <textarea name="reason" rows={3} required minLength={10} maxLength={1000} />
          </label>
          <button className="adm-btn adm-btn-primary" type="submit">Save override</button>
        </form>
        {e.overrideVerdict ? (
          <form action={clearOverrideAction} className="adm-form adm-top">
            <input type="hidden" name="id" value={e.id} />
            <label>
              Reason for clearing the override
              <input name="reason" required minLength={10} maxLength={1000} />
            </label>
            <button className="adm-btn" type="submit">Clear override</button>
          </form>
        ) : null}
      </Fold>

      <Fold title="Hide, rename or merge" open={e.hidden} hint={e.hidden ? "hidden from readers" : undefined}>
        <div className="adm-form">
          <form action={setHiddenAction}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="hidden" value={String(!e.hidden)} />
            <button className="adm-btn" type="submit">{e.hidden ? "Unhide event" : "Hide event"}</button>
          </form>
          <form action={renameEventAction} className="adm-form adm-top">
            <input type="hidden" name="id" value={e.id} />
            <label>
              Title
              <input name="title" defaultValue={e.titleOverride ?? e.title} required minLength={3} maxLength={200} />
            </label>
            <button className="adm-btn" type="submit">Rename</button>
          </form>
          <form action={mergeEventsAction} className="adm-form adm-top">
            <input type="hidden" name="id" value={e.id} />
            <label>
              Merge into another event. Moves observations and CVEs to the target and hides this event.
              <input name="into" placeholder="Target event id" required />
            </label>
            <button className="adm-btn" type="submit">Merge</button>
          </form>
        </div>
      </Fold>

      <Fold title={`Evidence (${d.observations.length})`}>
        <div className="adm-scroll" tabIndex={0} role="region" aria-label="Evidence table">
        {d.observations.length === 0 ? (
          <Empty>No observations attached.</Empty>
        ) : (
          <table className="adm-table adm-stack">
            <thead><tr><th>Observed</th><th>Source</th><th>Kind</th><th>Strength</th><th>Title</th></tr></thead>
            <tbody>
              {d.observations.map((o) => (
                <tr key={o.id}>
                  <td className="adm-mono" data-label="Observed">{fmt(o.observedAt)}</td>
                  <td className="adm-mono" data-label="Source">{o.sourceId}</td>
                  <td data-label="Kind">{o.kind}</td>
                  <td data-label="Strength">{o.strength}</td>
                  <td>
                    <a href={o.url} target="_blank" rel="noopener noreferrer">{o.title}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </Fold>

      <Fold title={`Verdict history (${d.history.length})`}>
        <div className="adm-scroll" tabIndex={0} role="region" aria-label="Verdict history table">
        {d.history.length === 0 ? (
          <Empty>No history.</Empty>
        ) : (
          <table className="adm-table adm-stack">
            <thead><tr><th>When</th><th>Verdict</th><th>Actor</th><th>Reason</th></tr></thead>
            <tbody>
              {d.history.map((h) => (
                <tr key={h.id}>
                  <td className="adm-mono" data-label="When">{fmt(h.changedAt)}</td>
                  <td data-label="Verdict"><VerdictPill verdict={h.verdict} /></td>
                  <td data-label="Actor">{h.actor}</td>
                  <td className="adm-small" data-label="Reason">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </Fold>
    </>
  );
}
