// Decides which alert issues to open and close from /status.json. Pure: no network, so it is unit
// tested (src/lib/api/plan-alerts.test.ts). Used by scripts/ops/freshness-probe.mjs.
//
// The probe owns every alert issue. Issues opened from inside the site used the owner's own token,
// so GitHub sent the owner no notification, and they stopped with the cron they watched.

export const COMPONENT_TITLE = /^\[alert\] Source (\S+):/;

/**
 * The parts of the report that get their own issue: each source and database storage. The events
 * sync does not, because the site freshness alert covers it.
 * @param {unknown} body  the /status.json report
 * @returns {{ id: string, name: string, state: string, reason: string }[]}
 */
export function components(body) {
  if (!body || typeof body !== "object") return [];
  const b = /** @type {Record<string, any>} */ (body);
  const out = [];
  for (const s of Array.isArray(b.sources?.list) ? b.sources.list : []) {
    if (s && typeof s.id === "string") out.push({ id: s.id, name: typeof s.name === "string" ? s.name : s.id, state: String(s.state), reason: typeof s.reason === "string" ? s.reason : "" });
  }
  if (b.database && typeof b.database === "object") {
    out.push({ id: "database-size", name: "Database storage", state: String(b.database.state), reason: typeof b.database.reason === "string" ? b.database.reason : "" });
  }
  return out;
}

const unhealthy = (state) => state === "failing" || state === "stale";
export const componentTitle = (c) => `[alert] Source ${c.id}: ${c.state === "failing" ? "failing" : "not updating"}`;

/**
 * @param {unknown} body  the /status.json report, or null when it could not be read
 * @param {{ number: number, title: string, pull_request?: unknown }[]} openIssues  open issues labeled `alert`
 * @param {Date} now
 * @returns {{ open: { id: string, title: string, body: string }[], close: { id: string, number: number }[] }}
 */
export function planAlerts(body, openIssues, now = new Date()) {
  const plan = { open: [], close: [] };
  // No readable report means no knowledge: leave component issues alone. The freshness alert speaks.
  if (!body || typeof body !== "object") return plan;
  const list = components(body);
  const byId = new Map(list.map((c) => [c.id, c]));
  const openById = new Map();
  for (const i of openIssues) {
    const m = !i.pull_request ? COMPONENT_TITLE.exec(i.title) : null;
    if (m && !openById.has(m[1])) openById.set(m[1], i.number);
  }
  for (const c of list) {
    if (!unhealthy(c.state) || openById.has(c.id)) continue;
    plan.open.push({
      id: c.id,
      title: componentTitle(c),
      body: [
        `${c.name} (\`${c.id}\`) needs attention. ${c.reason}`,
        "",
        `Read from /status.json at ${now.toISOString()} by the outside probe. The site keeps showing the last good data.`,
        "Agents: find the cause (check /admin/runs and the adapter), fix it, and reply here. This issue closes itself when the report shows it healthy again.",
      ].join("\n"),
    });
  }
  for (const [id, number] of openById) {
    const c = byId.get(id);
    // A source that left the report was retired or renamed; a person closes that one.
    if (!c || unhealthy(c.state)) continue;
    plan.close.push({ id, number });
  }
  return plan;
}
