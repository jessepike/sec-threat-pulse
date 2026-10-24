import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { eventDetail } from "@/lib/admin/queries";
import { getNarrative } from "@/lib/narrative/store";
import { draftEnabled } from "@/lib/narrative/draft";
import { RATINGS, ROLE_KEYS } from "@/lib/narrative/model";
import { RUNGS, RUNG_LABELS } from "@/lib/ladder/types";
import {
  clearOverrideAction,
  draftNarrativeAction,
  saveNarrativeAction,
  unpublishNarrativeAction,
  mergeEventsAction,
  overrideVerdictAction,
  renameEventAction,
  setHiddenAction,
} from "../../../actions";
import { Empty, Flash, NoDb, PageHead, VerdictPill, fmt, type SP } from "../../../_components/ui";

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
  const canDraft = draftEnabled();
  const pad = <T,>(a: T[], size: number, fill: T) => [...a, ...Array.from({ length: Math.max(0, size - a.length) }, () => fill)];
  const claimRows = pad(n?.claimChecks ?? [], (n?.claimChecks.length ?? 0) + 2, { claim: "", truth: "", rating: "TRUE" as const });
  const effective = e.overrideVerdict ?? e.verdict;
  return (
    <>
      <PageHead title={e.title} sub={`${e.id} · rules ${e.rulesVersion}`}>
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

      <section className="adm-card">
        <h2>Override verdict</h2>
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
      </section>

      <section className="adm-card">
        <h2>Narrative</h2>
        <p className="adm-small adm-muted">
          {n ? (
            <>
              Status: <strong>{n.status}</strong> · source: {n.source === "ai_draft" ? "AI draft" : "human"} · last edit by {n.updatedBy} at {fmt(n.updatedAt)}.
            </>
          ) : (
            "No narrative yet. Public pages show these sections only when published."
          )}
        </p>
        <form action={draftNarrativeAction} className="adm-form">
          <input type="hidden" name="id" value={e.id} />
          <button className="adm-btn" type="submit" disabled={!canDraft || n?.status === "published"}>Draft with AI</button>
          {!canDraft ? <p className="adm-small adm-muted">Set ANTHROPIC_API_KEY to enable AI drafts.</p> : null}
          {canDraft && n?.status === "published" ? <p className="adm-small adm-muted">Unpublish first to replace the text with an AI draft.</p> : null}
          <p className="adm-small adm-muted">An AI draft is saved unpublished. Check every line before you publish.</p>
        </form>
        <form action={saveNarrativeAction} className="adm-form adm-top">
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
            Ask your team (one question per line; the first shows in the home table)
            <textarea name="askYourTeam" rows={3} maxLength={1200} defaultValue={n?.askYourTeam ?? ""} />
          </label>
          <h3>Actions by role</h3>
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
          <h3>Claim checks</h3>
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
          <p className="adm-small adm-muted">Empty rows are ignored. Save again to get more empty rows.</p>
          <div>
            <button className="adm-btn" type="submit" name="intent" value="draft">Save draft</button>{" "}
            <button className="adm-btn adm-btn-primary" type="submit" name="intent" value="publish">Publish</button>
          </div>
        </form>
        {n?.status === "published" ? (
          <form action={unpublishNarrativeAction} className="adm-form adm-top">
            <input type="hidden" name="id" value={e.id} />
            <button className="adm-btn" type="submit">Unpublish</button>
          </form>
        ) : null}
      </section>

      <section className="adm-grid">
        <div className="adm-card">
          <h2>Visibility</h2>
          <form action={setHiddenAction}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="hidden" value={String(!e.hidden)} />
            <button className="adm-btn" type="submit">{e.hidden ? "Unhide event" : "Hide event"}</button>
          </form>
        </div>
        <div className="adm-card">
          <h2>Rename</h2>
          <form action={renameEventAction} className="adm-form">
            <input type="hidden" name="id" value={e.id} />
            <input name="title" defaultValue={e.title} required minLength={3} maxLength={200} aria-label="New title" />
            <button className="adm-btn" type="submit">Rename</button>
          </form>
        </div>
        <div className="adm-card">
          <h2>Merge into another event</h2>
          <p className="adm-small adm-muted">Moves observations and CVEs to the target and hides this event.</p>
          <form action={mergeEventsAction} className="adm-form">
            <input type="hidden" name="id" value={e.id} />
            <input name="into" placeholder="Target event id" required aria-label="Target event id" />
            <button className="adm-btn" type="submit">Merge</button>
          </form>
        </div>
      </section>

      <section className="adm-card adm-scroll">
        <h2>Observations ({d.observations.length})</h2>
        {d.observations.length === 0 ? (
          <Empty>No observations attached.</Empty>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Observed</th><th>Source</th><th>Kind</th><th>Strength</th><th>Title</th></tr></thead>
            <tbody>
              {d.observations.map((o) => (
                <tr key={o.id}>
                  <td className="adm-mono">{fmt(o.observedAt)}</td>
                  <td className="adm-mono">{o.sourceId}</td>
                  <td>{o.kind}</td>
                  <td>{o.strength}</td>
                  <td>
                    <a href={o.url} target="_blank" rel="noopener noreferrer">{o.title}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="adm-card adm-scroll">
        <h2>Verdict history</h2>
        {d.history.length === 0 ? (
          <Empty>No history.</Empty>
        ) : (
          <table className="adm-table">
            <thead><tr><th>When</th><th>Verdict</th><th>Actor</th><th>Reason</th></tr></thead>
            <tbody>
              {d.history.map((h) => (
                <tr key={h.id}>
                  <td className="adm-mono">{fmt(h.changedAt)}</td>
                  <td><VerdictPill verdict={h.verdict} /></td>
                  <td>{h.actor}</td>
                  <td className="adm-small">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
