import { REPO } from "@/lib/admin/github";
import type { SourceHealth } from "./health";

export const ALERT_LABEL = "alert";
const TITLE = /^\[alert\] Source (\S+):/;

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "SecurityThreatPulse-alerts",
  "content-type": "application/json",
});

export const alertTitle = (h: SourceHealth) => `[alert] Source ${h.id}: ${h.state === "failing" ? "failing" : "not updating"}`;

export interface AlertSyncResult {
  opened: string[];
  closed: string[];
  error?: string;
}

/**
 * Keeps one open GitHub issue per unhealthy source. Opens an issue when a source turns failing or
 * stale, leaves it alone while the source stays unhealthy, and comments and closes it once the
 * source is healthy again. Agent sessions pick these up like owner feedback.
 */
export async function syncAlerts(
  token: string,
  health: SourceHealth[],
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<AlertSyncResult> {
  const out: AlertSyncResult = { opened: [], closed: [] };
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${REPO}/issues?labels=${ALERT_LABEL}&state=open&per_page=100`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!res.ok) return { ...out, error: `GitHub answered ${res.status} listing alerts.` };
    const open = (await res.json()) as Array<{ number: number; title: string; pull_request?: unknown }>;
    const openBySource = new Map<string, number>();
    for (const i of open) {
      const m = !i.pull_request ? TITLE.exec(i.title) : null;
      if (m) openBySource.set(m[1], i.number);
    }
    const byId = new Map(health.map((h) => [h.id, h]));

    for (const h of health) {
      if ((h.state === "failing" || h.state === "stale") && !openBySource.has(h.id)) {
        const body = [
          `${h.name} (\`${h.id}\`) needs attention. ${h.reason}`,
          "",
          `Detected ${now.toISOString()} by the ingest health check. The site keeps showing the last good data.`,
          "Agents: find the cause (check /admin/runs and the adapter), fix it, and reply here. This issue closes itself when the source is healthy again.",
        ].join("\n");
        const r = await fetchImpl(`https://api.github.com/repos/${REPO}/issues`, {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify({ title: alertTitle(h), body, labels: [ALERT_LABEL] }),
        });
        if (r.ok) out.opened.push(h.id);
      }
    }

    for (const [id, number] of openBySource) {
      const h = byId.get(id);
      if (!h || h.state === "failing" || h.state === "stale") continue;
      await fetchImpl(`https://api.github.com/repos/${REPO}/issues/${number}/comments`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ body: `Recovered: \`${id}\` is healthy again as of ${now.toISOString()}. Closing.` }),
      });
      const r = await fetchImpl(`https://api.github.com/repos/${REPO}/issues/${number}`, {
        method: "PATCH",
        headers: headers(token),
        body: JSON.stringify({ state: "closed" }),
      });
      if (r.ok) out.closed.push(id);
    }
    return out;
  } catch (e) {
    return { ...out, error: e instanceof Error ? e.message : "Alert sync failed." };
  }
}
