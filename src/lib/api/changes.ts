import { sql } from "drizzle-orm";
import type { Db } from "@/lib/ingest/db";
import { VERDICT_LABELS, type Verdict } from "@/lib/ladder/types";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { xmlEscape } from "@/lib/feed";

/** Why a history row exists: the event appeared, its verdict moved, its ladder moved, or an admin overrode it. */
export type ChangeKind = "new" | "verdict" | "ladder" | "admin";

export interface ApiChange {
  /** History row id, stable and increasing. */
  id: number;
  eventId: string;
  url: string;
  title: string;
  at: string;
  kind: ChangeKind;
  verdict: Verdict;
  previousVerdict: Verdict | null;
  ladder: Record<string, string>;
  previousLadder: Record<string, string> | null;
  rulesVersion: string;
  reason: string | null;
}

export const CHANGES_DEFAULT_DAYS = 7;
export const CHANGES_MAX_DAYS = 90;
export const CHANGES_PAGE_SIZE = 100;

export function changeKind(row: { actor: string; previousVerdict: string | null; verdict: string }): ChangeKind {
  if (row.previousVerdict === null) return "new";
  if (row.actor.startsWith("admin")) return "admin";
  if (row.previousVerdict !== row.verdict) return "verdict";
  return "ladder";
}

/** Parses ?since= for the changes feed: default the last 7 days, never older than 90 days. */
export function parseChangesSince(raw: string | null, now: Date = new Date()): { since: Date } | { error: string } {
  const floor = new Date(now.getTime() - CHANGES_MAX_DAYS * 86_400_000);
  if (!raw) return { since: new Date(now.getTime() - CHANGES_DEFAULT_DAYS * 86_400_000) };
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return { error: "since must be an ISO 8601 timestamp" };
  return { since: new Date(Math.max(t, floor.getTime())) };
}

interface Row {
  id: number;
  event_id: string;
  title: string;
  title_override: string | null;
  verdict: string;
  ladder: Record<string, string>;
  rules_version: string;
  reason: string | null;
  actor: string;
  changed_at: string | Date;
}

const isAdmin = (r: Pick<Row, "actor">) => r.actor.startsWith("admin");
const isOverrideClear = (r: Pick<Row, "actor" | "reason">) => isAdmin(r) && (r.reason ?? "").startsWith("Admin override cleared");

/**
 * Verdict and ladder changes on visible events since a time, newest first, each with the state it
 * replaced. Reads verdict_history, which the events sync appends to when a verdict or ladder moves
 * and when an event first appears, and which admin overrides and clears append to as well.
 *
 * The public verdict is the override while one is active, so the rows are walked per event in
 * order and each one's effective verdict is the active override, if any, else the row's own. A
 * sync row written under an override is then an evidence change, never a verdict change, and the
 * admin row that sets or clears an override is the only place the public verdict moves.
 */
export async function apiChanges(db: Db, since: Date, page = 1): Promise<{ total: number; page: number; pages: number; changes: ApiChange[] }> {
  // Every row of every visible event that has a row in the window: the rows before the window are
  // needed to know the state the first in-window row replaced. The table holds one row per change,
  // so this stays small (hundreds of rows a month).
  const res = await db.execute(sql`
    select h.id, h.event_id, h.verdict, h.ladder, h.rules_version, h.reason, h.actor, h.changed_at, e.title, e.title_override
    from verdict_history h join events e on e.id = h.event_id
    where e.hidden = false
      and h.event_id in (select event_id from verdict_history where changed_at >= ${since.toISOString()})
    order by h.event_id, h.changed_at, h.id`);
  const rows = ((res as unknown as { rows?: Row[] }).rows ?? (res as unknown as Row[])).map((r) => ({
    ...r,
    ladder: typeof r.ladder === "string" ? (JSON.parse(r.ladder) as Record<string, string>) : r.ladder,
  }));
  const out: ApiChange[] = [];
  let eventId: string | null = null;
  let override: string | null = null;
  let prevVerdict: string | null = null;
  let prevLadder: Record<string, string> | null = null;
  for (const r of rows) {
    if (r.event_id !== eventId) {
      eventId = r.event_id;
      override = null;
      prevVerdict = null;
      prevLadder = null;
    }
    if (isAdmin(r)) override = isOverrideClear(r) ? null : r.verdict;
    const effective = override ?? r.verdict;
    const at = new Date(r.changed_at);
    if (at >= since) {
      out.push({
        id: Number(r.id),
        eventId: r.event_id,
        url: `${SITE_URL}/events/${r.event_id}`,
        title: r.title_override ?? r.title,
        at: at.toISOString(),
        kind: changeKind({ actor: r.actor, previousVerdict: prevVerdict, verdict: effective }),
        verdict: effective as Verdict,
        previousVerdict: (prevVerdict as Verdict | null) ?? null,
        ladder: r.ladder,
        previousLadder: prevLadder,
        rulesVersion: r.rules_version,
        reason: r.reason,
      });
    }
    prevVerdict = effective;
    prevLadder = r.ladder;
  }
  out.sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
  const pages = Math.max(1, Math.ceil(out.length / CHANGES_PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  return { total: out.length, page: p, pages, changes: out.slice((p - 1) * CHANGES_PAGE_SIZE, p * CHANGES_PAGE_SIZE) };
}

/** One plain line per change, for feed titles and agents. */
export function changeHeadline(c: Pick<ApiChange, "title" | "kind" | "verdict" | "previousVerdict">): string {
  const now = VERDICT_LABELS[c.verdict];
  if (c.kind === "new") return `New: ${c.title} (${now})`;
  if (c.kind === "verdict" || (c.kind === "admin" && c.previousVerdict && c.previousVerdict !== c.verdict)) return `${c.title}: now ${now}, was ${VERDICT_LABELS[c.previousVerdict!]}`;
  if (c.kind === "admin") return `${c.title}: reviewed by STP, still ${now}`;
  return `${c.title}: evidence changed, still ${now}`;
}

/** Rungs whose state moved, as "attempts none -> confirmed". */
export function ladderDiff(prev: Record<string, string> | null, next: Record<string, string>): string[] {
  if (!prev) return [];
  return Object.keys(next)
    .filter((k) => (prev[k] ?? "none") !== (next[k] ?? "none"))
    .map((k) => `${k} ${prev[k] ?? "none"} to ${next[k] ?? "none"}`);
}

/** RSS 2.0 feed of verdict and ladder changes, newest first. */
export function changesFeed(changes: ApiChange[], site: string = SITE_URL): string {
  const items = changes.map((c) => {
    const link = `${site}/events/${c.eventId}`;
    const diff = ladderDiff(c.previousLadder, c.ladder);
    const text = [c.reason, diff.length ? `Ladder: ${diff.join("; ")}.` : null, `Rules ${c.rulesVersion}.`].filter(Boolean).join(" ");
    return [
      "    <item>",
      `      <title>${xmlEscape(changeHeadline(c))}</title>`,
      `      <link>${xmlEscape(link)}</link>`,
      `      <guid isPermaLink="false">${xmlEscape(`stp-change-${c.id}`)}</guid>`,
      `      <pubDate>${new Date(c.at).toUTCString()}</pubDate>`,
      `      <description>${xmlEscape(text)}</description>`,
      "    </item>",
    ].join("\n");
  });
  const built = changes.length ? new Date(changes[0].at).toUTCString() : new Date(0).toUTCString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlEscape(`${SITE_NAME}: changes`)}</title>`,
    `    <link>${site}/events</link>`,
    `    <atom:link href="${site}/events/changes.xml" rel="self" type="application/rss+xml" />`,
    "    <description>Every verdict or ladder change on a tracked event, newest first, with the state it replaced. Not advice.</description>",
    "    <language>en-us</language>",
    `    <lastBuildDate>${built}</lastBuildDate>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
