import type { HealthState } from "@/lib/ingest/health";

/** One line in the overview inbox: something that needs the owner or an agent. */
export interface AttentionItem {
  key: string;
  tone: "act" | "watch";
  label: string;
  text: string;
  /** Where to go to deal with it. Missing when no admin page helps. */
  href?: string;
  action?: string;
}

export interface AttentionInput {
  /** Open alerts from the health check (sources, the event builder, database storage). */
  alerts: { sourceId: string; name: string; reason: string }[];
  /** Enabled sources whose last run failed. */
  failing: { id: string; name: string; lastError: string | null }[];
  /** Saved write-ups that readers cannot see yet. */
  drafts: { eventId: string; title: string }[];
}

const NOT_A_SOURCE = new Set(["events-sync", "database-size"]);
const runsHref = (id: string) => `/admin/runs?source=${encodeURIComponent(id)}&status=error`;

/**
 * Builds the overview inbox, worst first: open alerts, then sources whose last run failed but
 * that have not alerted yet, then drafts waiting to be published. A source appears once.
 */
export function attentionItems({ alerts, failing, drafts }: AttentionInput): AttentionItem[] {
  const out: AttentionItem[] = [];
  const seen = new Set<string>();
  for (const a of alerts) {
    seen.add(a.sourceId);
    const source = !NOT_A_SOURCE.has(a.sourceId);
    out.push({
      key: `alert:${a.sourceId}`,
      tone: "act",
      label: "Alert",
      text: `${a.name}. ${a.reason}`,
      href: source ? runsHref(a.sourceId) : a.sourceId === "events-sync" ? "/admin/runs" : undefined,
      action: source ? "See failed runs" : a.sourceId === "events-sync" ? "See runs" : undefined,
    });
  }
  for (const s of failing) {
    if (seen.has(s.id)) continue;
    out.push({
      key: `source:${s.id}`,
      tone: "watch",
      label: "Last run failed",
      text: `${s.name}. ${(s.lastError ?? "No error text was recorded.").slice(0, 200)}`,
      href: runsHref(s.id),
      action: "See failed runs",
    });
  }
  for (const d of drafts) {
    out.push({
      key: `draft:${d.eventId}`,
      tone: "watch",
      label: "Draft",
      text: `${d.title}. The write-up is saved and readers cannot see it yet.`,
      href: `/admin/events/${encodeURIComponent(d.eventId)}`,
      action: "Review and publish",
    });
  }
  return out;
}

export type SourceState = "failing" | "stale" | "error" | "ok" | "new" | "off";

const ORDER: Record<SourceState, number> = { failing: 0, stale: 1, error: 2, ok: 3, new: 4, off: 5 };

/** One word for a source: the health check's state when it alerts, else how its last run went. */
export function sourceState(s: { enabled: boolean; lastError: string | null; lastRunAt: Date | null }, health: HealthState | undefined): SourceState {
  if (!s.enabled) return "off";
  if (health === "failing" || health === "stale") return health;
  if (s.lastError) return "error";
  return s.lastRunAt ? "ok" : "new";
}

/** Sources that need a look come first; inside one state they sort by name. */
export function sortSources<T extends { name: string; state: SourceState }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));
}
