import { unstable_cache } from "next/cache";
import { RUNGS } from "@/lib/ladder/types";
import { countVerdicts, dbBriefEvents, dbCorrections, dbEvent, dbEventEntries, dbEventsPage, dbHomeEvents, dbKevCounts, dbStatus, firstSentence } from "./db";
import { EVENTS_PAGE_SIZE, homeSelection, paginateListed, type Listable } from "./listing";
import {
  ACTIONS,
  LIVE_ACTIONS,
  BRIEF_STATIC,
  LIVE_BRIEF_STATIC,
  DRIVERS,
  LIVE_BOTTOM_LINE,
  NOISE,
  RANSOMWARE,
  REPORT_KPIS,
  SAMPLE_BRIEF,
  SAMPLE_COUNTS_NOTE,
  SAMPLE_HERO_BLURB,
  SAMPLE_KEV_KPI,
  SAMPLE_REAL,
  SAMPLE_WEEK_OF,
} from "./editorial";
import { fmtDay, weekOfLabel } from "./format";
import { SAMPLE_EVENTS } from "./sample";
import type { BriefData, CorrectionView, DataMode, EventRow, EventsIndexData, EventView, HomeData, KpiView, StatusView, VerdictFilter } from "./types";

export * from "./types";
export { EVENTS_PAGE_SIZE, parsePage, parseVerdictFilter } from "./listing";
export { RUNG_SHORT } from "./sample";

const REVALIDATE = 300;

export function getMode(): DataMode {
  return process.env.DATABASE_URL ? "live" : "sample";
}

const toRow = (e: EventView): EventRow => ({
  id: e.id,
  href: e.href,
  title: e.title,
  idsLabel: e.idsLabel,
  exposure: e.exposure,
  question: e.question,
  verdict: e.verdict,
  ladder: e.ladder,
  topConfirmed: e.topConfirmed,
});

const SAMPLE_STATUS: StatusView = {
  mode: "sample",
  lastRunAt: "2026-10-23T17:40:00Z",
  nextRunAt: "2026-10-23T23:40:00Z",
  progress: 62,
  runsPerDay: "4 RUNS / DAY",
  sourceCount: 112,
};

export async function getStatus(): Promise<StatusView> {
  if (getMode() === "sample") return SAMPLE_STATUS;
  return liveStatus();
}
const liveStatus = unstable_cache(() => dbStatus(), ["stp-status"], { revalidate: REVALIDATE, tags: ["stp"] });

/** Sample events in the same shape the live lists use, so both modes share one ordering. */
const SAMPLE_LISTED: (Listable & { view: EventView })[] = SAMPLE_EVENTS.map((view) => {
  const times = [view.updatedAt, ...view.rungs.map((r) => r.newestAt)].filter((x): x is string => !!x).map((x) => Date.parse(x));
  return { id: view.id, verdict: view.verdict, evidenceAt: Math.max(...times), reports: view.sources.length, view };
});

function sampleHome(): HomeData {
  // Sample dates are fixed, so measure the 30-day Act now window from the newest sample evidence.
  const shown = homeSelection(SAMPLE_LISTED, Math.max(...SAMPLE_LISTED.map((x) => x.evidenceAt))).map((x) => x.view);
  const events = shown.map(toRow);
  // The sample hero blurb is written for the flagship sample event, so it stays the hero.
  const hero = SAMPLE_EVENTS[0];
  return {
    status: SAMPLE_STATUS,
    weekOf: SAMPLE_WEEK_OF,
    hero: { id: hero.id, href: hero.href, title: hero.title, verdict: hero.verdict, idsLabel: `${hero.idsLabel} · CVSS ${hero.cvss?.toFixed(1)}`, blurb: SAMPLE_HERO_BLURB },
    counts: countVerdicts(SAMPLE_EVENTS),
    countsNote: SAMPLE_COUNTS_NOTE,
    kpis: [SAMPLE_KEV_KPI, ...REPORT_KPIS],
    real: SAMPLE_REAL,
    noise: NOISE,
    actions: ACTIONS,
    events,
    totalEvents: SAMPLE_EVENTS.length,
    drivers: DRIVERS,
    ransomware: RANSOMWARE,
  };
}

async function liveHome(): Promise<HomeData> {
  const [{ counts, items: list }, status, kev] = await Promise.all([dbHomeEvents(), dbStatus(), dbKevCounts()]);
  const events = list.map((x) => x.row);
  const top = list[0];
  const realItems = list
    .filter((x) => x.row.verdict === "act_now")
    .slice(0, 3)
    .map((x) => ({ title: x.row.title, text: x.summary ? firstSentence(x.summary, 220) : "No summary written yet." }));
  const kevKpi: KpiView = {
    label: "NEW CONFIRMED EXPLOITED · 7D",
    value: String(kev.d7),
    delta: `${kev.d30} IN 30 DAYS`,
    deltaTone: "muted",
    meaning: "Flaws CISA confirmed are used in real attacks.",
    source: "CISA KEV",
    sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  };
  return {
    status,
    weekOf: weekOfLabel(new Date()),
    hero: top
      ? {
          id: top.row.id,
          href: top.row.href,
          title: top.row.title,
          verdict: top.row.verdict,
          idsLabel: top.cvss ? `${top.row.idsLabel} · CVSS ${top.cvss.toFixed(1)}` : top.row.idsLabel,
          blurb: top.summary || "No summary written yet.",
        }
      : null,
    counts,
    countsNote: counts.total === 0 ? "No events are tracked yet." : "Counts follow the published verdict rules.",
    kpis: [kevKpi, ...REPORT_KPIS],
    real: realItems,
    noise: NOISE.filter((n) => !n.title.includes("PHP2Shell")),
    actions: LIVE_ACTIONS,
    events,
    totalEvents: counts.total,
    drivers: DRIVERS,
    ransomware: RANSOMWARE.filter((r) => !r.needsApproval),
  };
}
const cachedLiveHome = unstable_cache(liveHome, ["stp-home"], { revalidate: REVALIDATE, tags: ["stp"] });

export async function getHomeData(): Promise<HomeData> {
  return getMode() === "sample" ? sampleHome() : cachedLiveHome();
}

const cachedLiveEvent = unstable_cache(async (id: string) => dbEvent(id), ["stp-event"], { revalidate: REVALIDATE, tags: ["stp"] });

export async function getEvent(id: string): Promise<{ event: EventView; status: StatusView } | null> {
  if (getMode() === "sample") {
    const event = SAMPLE_EVENTS.find((e) => e.id === id);
    return event ? { event, status: SAMPLE_STATUS } : null;
  }
  const [event, status] = await Promise.all([cachedLiveEvent(id), liveStatus()]);
  return event ? { event, status } : null;
}

function sampleBrief(): BriefData {
  const flagship = SAMPLE_EVENTS[0];
  return {
    weekOf: SAMPLE_WEEK_OF,
    bottomLine: SAMPLE_BRIEF.bottomLine,
    counts: countVerdicts(SAMPLE_EVENTS),
    changes: SAMPLE_BRIEF.changes,
    flagship: { title: flagship.title, ladder: flagship.ladder },
    position: BRIEF_STATIC.position,
    notConcern: BRIEF_STATIC.notConcern,
    questions: BRIEF_STATIC.questions,
    sourcesLine: BRIEF_STATIC.sourcesLine,
  };
}

/** One factual sentence pair from live counts. No judgment words beyond the published verdict names. */
export function briefBottomLine(kev: { d7: number; d30: number }, actNow: number): string {
  const flaws = (n: number) => (n === 1 ? "1 newly exploited flaw" : `${n} newly exploited flaws`);
  return `CISA confirmed ${flaws(kev.d7)} in the last 7 days and ${kev.d30} in the last 30 days. ${actNow === 1 ? "1 event is" : `${actNow} events are`} rated Act now.`;
}

async function liveBrief(): Promise<BriefData> {
  const [{ counts, top, recent }, kev] = await Promise.all([dbBriefEvents(), dbKevCounts()]);
  return {
    weekOf: weekOfLabel(new Date()),
    bottomLine: briefBottomLine(kev, counts.act_now) || LIVE_BOTTOM_LINE,
    counts,
    changes: recent.map((x) => ({ lead: `${x.row.title}.`, text: x.summary ? firstSentence(x.summary, 220) : `Updated ${fmtDay(x.updatedAt)}.` })),
    flagship: top ? { title: top.row.title, ladder: top.row.ladder } : null,
    position: LIVE_BRIEF_STATIC.position,
    notConcern: BRIEF_STATIC.notConcern,
    questions: BRIEF_STATIC.questions,
    sourcesLine: LIVE_BRIEF_STATIC.sourcesLine,
  };
}
const cachedLiveBrief = unstable_cache(liveBrief, ["stp-brief"], { revalidate: REVALIDATE, tags: ["stp"] });

export async function getBriefData(): Promise<{ brief: BriefData; mode: DataMode }> {
  const mode = getMode();
  return { brief: mode === "sample" ? sampleBrief() : await cachedLiveBrief(), mode };
}

const cachedLiveEventsPage = unstable_cache(async (filter: VerdictFilter, page: number) => dbEventsPage(filter, page), ["stp-events-page"], { revalidate: REVALIDATE, tags: ["stp"] });

/** The /events index: filterable by verdict, 50 events a page. */
export async function getEventsIndex(filter: VerdictFilter, page: number): Promise<EventsIndexData> {
  const mode = getMode();
  if (mode === "sample") {
    const p = paginateListed(SAMPLE_LISTED, filter, page);
    return {
      status: SAMPLE_STATUS,
      mode,
      filter,
      counts: countVerdicts(SAMPLE_EVENTS),
      rows: p.items.map((x) => toRow(x.view)),
      total: p.total,
      page: p.page,
      pages: p.pages,
      pageSize: EVENTS_PAGE_SIZE,
    };
  }
  const [r, status] = await Promise.all([cachedLiveEventsPage(filter, page), liveStatus()]);
  return { status, mode, filter, counts: r.counts, rows: r.rows, total: r.total, page: r.page, pages: r.pages, pageSize: EVENTS_PAGE_SIZE };
}

const cachedLiveCorrections = unstable_cache(async () => dbCorrections(), ["stp-corrections"], { revalidate: REVALIDATE, tags: ["stp"] });

/** The public corrections log, newest first. Sample mode has none. */
export async function getCorrections(): Promise<{ mode: DataMode; rows: CorrectionView[] }> {
  const mode = getMode();
  return { mode, rows: mode === "sample" ? [] : await cachedLiveCorrections() };
}

const cachedLiveEventEntries = unstable_cache(async () => dbEventEntries(), ["stp-event-entries"], { revalidate: 3600, tags: ["stp"] });

/** Every public event id with its last update, for the sitemap. */
export async function getEventEntries(): Promise<{ id: string; updatedAt: string }[]> {
  if (getMode() === "sample") return SAMPLE_EVENTS.map((e) => ({ id: e.id, updatedAt: e.updatedAt }));
  try {
    return await cachedLiveEventEntries();
  } catch {
    return [];
  }
}

export const RUNG_ORDER = RUNGS;
