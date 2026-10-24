import type { Verdict } from "@/lib/ladder/types";
import type { VerdictFilter } from "./types";

/** Home page caps. Act now events are not capped by count, only by how recent their evidence is. */
export const HOME_ACT_NOW_DAYS = 30;
export const HOME_WATCH_CAP = 12;
export const HOME_LOW_CAP = 6;
export const EVENTS_PAGE_SIZE = 50;
/** An early event (id starts with "early-") needs this many reports to reach the home page as Watch. */
export const EARLY_HOME_MIN_REPORTS = 2;

export interface Listable {
  id: string;
  verdict: Verdict;
  /** Milliseconds since the epoch of the newest evidence on the event. */
  evidenceAt: number;
  /**
   * Milliseconds since the epoch of the newest dated report of attacks, exploitation or damage.
   * The home page uses it to decide whether an Act now event is recent; falls back to evidenceAt.
   */
  signalAt?: number;
  /** Number of reports (observations) attached to the event. */
  reports: number;
}

const RANK: Record<Verdict, number> = { act_now: 0, watch: 1, low: 2 };

export const isEarlyEvent = (id: string) => id.startsWith("early-");

/** Verdict first (Act now, Watch, Low), then the most recent evidence, then id for a stable order. */
export function compareListed(a: Listable, b: Listable): number {
  return RANK[a.verdict] - RANK[b.verdict] || b.evidenceAt - a.evidenceAt || a.id.localeCompare(b.id);
}

export function sortListed<T extends Listable>(items: T[]): T[] {
  return [...items].sort(compareListed);
}

/**
 * What the home page shows from the full list: every Act now with an attack, exploitation or damage report dated in the last 30 days,
 * then up to 12 Watch and 6 Low. Older Act now events stay on the /events index.
 */
export function homeSelection<T extends Listable>(items: T[], now: number = Date.now()): T[] {
  const actNowSince = now - HOME_ACT_NOW_DAYS * 86_400_000;
  const out: T[] = [];
  let watch = 0;
  let low = 0;
  for (const it of sortListed(items)) {
    if (it.verdict === "act_now") {
      if ((it.signalAt ?? it.evidenceAt) >= actNowSince) out.push(it);
    }
    else if (it.verdict === "watch") {
      if (isEarlyEvent(it.id) && it.reports < EARLY_HOME_MIN_REPORTS) continue;
      if (watch < HOME_WATCH_CAP) {
        out.push(it);
        watch += 1;
      }
    } else if (low < HOME_LOW_CAP) {
      out.push(it);
      low += 1;
    }
  }
  return out;
}

export function parseVerdictFilter(v: string | string[] | undefined): VerdictFilter {
  const x = Array.isArray(v) ? v[0] : v;
  return x === "act_now" || x === "watch" || x === "low" ? x : "all";
}

export function parsePage(v: string | string[] | undefined): number {
  const x = Array.isArray(v) ? v[0] : v;
  const n = Number.parseInt(x ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

export function paginateListed<T extends Listable>(items: T[], filter: VerdictFilter, page: number, size = EVENTS_PAGE_SIZE) {
  const matching = sortListed(items).filter((x) => filter === "all" || x.verdict === filter);
  const pages = Math.max(1, Math.ceil(matching.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: matching.slice((current - 1) * size, current * size), total: matching.length, page: current, pages };
}

/** Link to a page of the /events index. Default values stay out of the query string. */
export function eventsHref(filter: VerdictFilter, page: number): string {
  const q = new URLSearchParams();
  if (filter !== "all") q.set("verdict", filter);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/events?${s}` : "/events";
}
