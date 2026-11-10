import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/admin/session";
import { ownerItems, parseBacklog, sectionLabel, type BacklogPhase } from "@/lib/admin/backlog";
import { FEEDBACK_LABEL, REPO, listFeedback, listIssues } from "@/lib/admin/github";
import { addFeedbackAction, addIdeaAction } from "../../actions";
import { Empty, Flash, PageHead, fmt, type SP } from "../../_components/ui";

export const metadata = { title: "Roadmap" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

async function loadPhases(): Promise<BacklogPhase[]> {
  try {
    return parseBacklog(await readFile(path.join(process.cwd(), "BACKLOG.md"), "utf8"));
  } catch {
    return [];
  }
}

export default async function RoadmapPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const token = process.env.GITHUB_TOKEN;
  const [phases, issues, feedback] = await Promise.all([
    loadPhases(),
    token ? listIssues(token) : Promise.resolve(null),
    token ? listFeedback(token) : Promise.resolve(null),
  ]);
  const topics = ["General", ...phases.map(sectionLabel)];
  const waves = phases.filter((p) => p.wave !== null);
  const rest = phases.filter((p) => p.wave === null);
  const waiting = ownerItems(phases);
  const openCount = (list: BacklogPhase[]) => list.reduce((n, p) => n + p.items.filter((i) => !i.done).length, 0);
  // The wave being worked on: the first with an open item.
  const currentWave = waves.find((p) => p.items.some((i) => !i.done))?.key;
  const group = (list: BacklogPhase[], isOpen: (p: BacklogPhase) => boolean) =>
    list.map((p) => {
      const done = p.items.filter((i) => i.done).length;
      return (
        <details key={p.key} className="adm-card adm-phase" open={isOpen(p)}>
          <summary>
            <span className="adm-phase-name">{sectionLabel(p)}</span>
            {p.items.length ? (
              <span className="adm-muted adm-mono">
                {done}/{p.items.length}
              </span>
            ) : (
              <span className="adm-muted">no checklist</span>
            )}
          </summary>
          {p.gate ? (
            <p className="adm-gate">
              <span className="adm-muted">Gate</span> {p.gate}
            </p>
          ) : null}
          <ul className="adm-checks">
            {p.items.map((i, n) => (
              <li key={n} className={i.done ? "adm-done" : ""}>
                <span aria-hidden>{i.done ? "[x]" : "[ ]"}</span> <span className="adm-sr">{i.done ? "Done: " : "Open: "}</span>
                {i.text}
              </li>
            ))}
          </ul>
        </details>
      );
    });
  const otherIssues = issues && issues.ok ? issues.issues.filter((i) => !i.labels.includes(FEEDBACK_LABEL)) : [];

  return (
    <>
      <PageHead title="Roadmap" sub="The wave plan and the earlier phases, read from BACKLOG.md as deployed, plus feedback and ideas from GitHub Issues." />
      <Flash sp={sp} />

      <section className="adm-card" id="feedback">
        <h2>Feedback for agents</h2>
        <p className="adm-muted adm-small">
          Each note becomes a GitHub issue labeled &quot;{FEEDBACK_LABEL}&quot;. The next agent session reads open notes first,
          acts on them, replies on the issue and closes it when done.
        </p>
        {!token ? (
          <p className="adm-muted">Disabled. Set GITHUB_TOKEN (issues read and write on {REPO}) to save feedback.</p>
        ) : null}
        <form action={addFeedbackAction} className="adm-form">
          <label>
            Topic
            <select name="topic" defaultValue="General" disabled={!token}>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Feedback
            <textarea name="text" rows={4} required minLength={3} maxLength={5000} disabled={!token} />
          </label>
          <button className="adm-btn adm-btn-primary" type="submit" disabled={!token}>
            Send to agents
          </button>
        </form>
        {feedback && !feedback.ok ? (
          <p className="adm-flash adm-flash-error">Could not load feedback: {feedback.error}</p>
        ) : feedback && feedback.ok && feedback.items.length ? (
          <table className="adm-table adm-stack">
            <thead>
              <tr>
                <th>Status</th>
                <th>Feedback</th>
                <th>Replies</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {feedback.items.map((f) => (
                <tr key={f.number}>
                  <td>
                    <span className="adm-pill">{f.open ? (f.comments ? "Answered, open" : "Waiting") : "Done"}</span>
                  </td>
                  <td>
                    <a href={f.url} target="_blank" rel="noopener noreferrer">
                      {f.title}
                    </a>
                  </td>
                  <td className="adm-mono">{f.comments}</td>
                  <td className="adm-mono">{fmt(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {phases.length === 0 ? <Empty>BACKLOG.md could not be read.</Empty> : null}

      {waiting.length ? (
        <section className="adm-card" aria-labelledby="waiting">
          <h2 id="waiting">Waiting on you ({waiting.length})</h2>
          <ul className="adm-inbox">
            {waiting.map((w, n) => (
              <li key={n}>
                <span className="adm-inbox-text">{w.text}</span>
                <span className="adm-muted adm-small">{w.section}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {waves.length ? (
        <section className="adm-phases" aria-labelledby="waves">
          <h2 id="waves">The wave plan ({openCount(waves)} open)</h2>
          {group(waves, (p) => p.key === currentWave)}
        </section>
      ) : null}

      {rest.length ? (
        <section className="adm-phases" aria-labelledby="phases">
          <h2 id="phases">Earlier phases and other lists ({openCount(rest)} open)</h2>
          {group(rest, () => false)}
        </section>
      ) : null}

      <section className="adm-card">
        <h2>Backlog from GitHub Issues</h2>
        <p className="adm-muted adm-small">{REPO}</p>
        {!token ? (
          <Empty>GITHUB_TOKEN is not set, so issues are not loaded. The phase list above comes from BACKLOG.md.</Empty>
        ) : issues && !issues.ok ? (
          <p className="adm-flash adm-flash-error">Could not load issues: {issues.error}</p>
        ) : issues && issues.ok && otherIssues.length === 0 ? (
          <Empty>No open issues.</Empty>
        ) : issues && issues.ok ? (
          <table className="adm-table adm-stack">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Labels</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {otherIssues.map((i) => (
                <tr key={i.number}>
                  <td className="adm-mono">{i.number}</td>
                  <td>
                    <a href={i.url} target="_blank" rel="noopener noreferrer">
                      {i.title}
                    </a>
                  </td>
                  <td>{i.labels.map((l) => <span key={l} className="adm-pill">{l}</span>)}</td>
                  <td className="adm-mono">{fmt(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="adm-card">
        <h2>Add an idea</h2>
        {!token ? (
          <p className="adm-muted">Disabled. Set GITHUB_TOKEN (issues write access) to create ideas as GitHub issues.</p>
        ) : null}
        <form action={addIdeaAction} className="adm-form">
          <label>
            Title
            <input name="title" required minLength={3} maxLength={140} disabled={!token} />
          </label>
          <label>
            Details
            <textarea name="body" rows={4} disabled={!token} />
          </label>
          <button className="adm-btn adm-btn-primary" type="submit" disabled={!token}>
            Create issue
          </button>
        </form>
      </section>
    </>
  );
}
