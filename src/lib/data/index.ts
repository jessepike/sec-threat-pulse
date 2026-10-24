import { unstable_cache } from "next/cache";
import { RUNGS } from "@/lib/ladder/types";
import { countVerdicts, dbEvent, dbEventSummaries, dbKevCounts, dbStatus } from "./db";
import {
  ACTIONS,
  LIVE_ACTIONS,
  BRIEF_STATIC,
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
import type { BriefData, DataMode, EventRow, EventView, HomeData, KpiView, StatusView } from "./types";

export * from "./types";
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

function sampleHome(): HomeData {
  const events = SAMPLE_EVENTS.map(toRow);
  const hero = SAMPLE_EVENTS[0];
  return {
    status: SAMPLE_STATUS,
    weekOf: SAMPLE_WEEK_OF,
    hero: { id: hero.id, href: hero.href, title: hero.title, verdict: hero.verdict, idsLabel: `${hero.idsLabel} · CVSS ${hero.cvss?.toFixed(1)}`, blurb: SAMPLE_HERO_BLURB },
    counts: countVerdicts(events),
    countsNote: SAMPLE_COUNTS_NOTE,
    kpis: [SAMPLE_KEV_KPI, ...REPORT_KPIS],
    real: SAMPLE_REAL,
    noise: NOISE,
    actions: ACTIONS,
    events,
    drivers: DRIVERS,
    ransomware: RANSOMWARE,
  };
}

async function liveHome(): Promise<HomeData> {
  const [list, status, kev] = await Promise.all([dbEventSummaries(), dbStatus(), dbKevCounts()]);
  const events = list.map((x) => x.row);
  const counts = countVerdicts(events);
  const top = list[0];
  const realItems = list
    .filter((x) => x.row.verdict === "act_now")
    .slice(0, 3)
    .map((x) => ({ title: x.row.title, text: x.summary || "No summary written yet." }));
  const kevKpi: KpiView = {
    label: "NEW CONFIRMED EXPLOITED · 7D",
    value: String(kev.d7),
    delta: `▲ ${kev.d30} IN 30D`,
    deltaTone: "crit",
    meaning: "Flaws CISA confirmed are used in real attacks.",
    source: "CISA KEV",
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

async function liveBrief(): Promise<BriefData> {
  const list = await dbEventSummaries();
  const counts = countVerdicts(list.map((x) => x.row));
  const week = Date.now() - 7 * 86_400_000;
  const recent = list.filter((x) => new Date(x.updatedAt).getTime() >= week).slice(0, 3);
  const top = list[0];
  return {
    weekOf: weekOfLabel(new Date()),
    bottomLine: LIVE_BOTTOM_LINE,
    counts,
    changes: recent.map((x) => ({ lead: `${x.row.title}.`, text: x.summary || `Updated ${fmtDay(x.updatedAt)}.` })),
    flagship: top ? { title: top.row.title, ladder: top.row.ladder } : null,
    position: BRIEF_STATIC.position,
    notConcern: BRIEF_STATIC.notConcern,
    questions: BRIEF_STATIC.questions,
    sourcesLine: BRIEF_STATIC.sourcesLine,
  };
}
const cachedLiveBrief = unstable_cache(liveBrief, ["stp-brief"], { revalidate: REVALIDATE, tags: ["stp"] });

export async function getBriefData(): Promise<{ brief: BriefData; mode: DataMode }> {
  const mode = getMode();
  return { brief: mode === "sample" ? sampleBrief() : await cachedLiveBrief(), mode };
}

export const RUNG_ORDER = RUNGS;
