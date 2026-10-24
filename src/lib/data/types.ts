import type { ExploitMaturity, Ladder, Rung, Verdict } from "@/lib/ladder/types";

export type DataMode = "sample" | "live";

export interface SourceRef {
  label: string;
  url?: string;
  /** ISO timestamp or date. */
  at?: string;
}

export interface Fact {
  label: string;
  value: string;
  tone?: "ok" | "default";
}

export interface RungView {
  rung: Rung;
  num: string;
  /** Short name used in headers and segments, for example "EXPOSED". */
  step: string;
  state: Ladder[Rung];
  evidence: string;
  sources: SourceRef[];
  /** ISO timestamp or date of the newest evidence on this rung, if any. */
  newestAt?: string;
}

export interface EventRow {
  id: string;
  href: string;
  title: string;
  idsLabel: string;
  exposure: string;
  question: string | null;
  verdict: Verdict;
  ladder: Ladder;
  topConfirmed: Rung | null;
}

export type ClaimRating = "TRUE" | "OVERSTATED" | "TOO EARLY" | "FALSE" | "UNVERIFIED";

export interface ClaimView {
  claim: string;
  truth: string;
  rating: ClaimRating;
}

export interface TimelineItem {
  when: string;
  what: string;
  hot?: boolean;
}

export interface RoleActions {
  role: string;
  items: string[];
}

export interface BlastView {
  headline?: { value: string; text: string };
  paragraphs: { lead: string; text: string }[];
  note?: string;
}

export interface EventView extends EventRow {
  cves: string[];
  cvss?: number;
  summary: string;
  verdictReason?: string;
  exploitMaturity: ExploitMaturity;
  facts: Fact[];
  rungs: RungView[];
  verdictChangesIf?: string;
  businessTerms?: string;
  whyAct?: string;
  fix?: string;
  askYourTeam?: string[];
  /** True when a published narrative started as an AI draft and was reviewed by STP. */
  aiDrafted?: boolean;
  claims: ClaimView[];
  timeline: TimelineItem[];
  blast?: BlastView;
  roles: RoleActions[];
  sources: SourceRef[];
  updatedAt: string;
  trackingSince: string;
}

export interface StatusView {
  mode: DataMode;
  lastRunAt: string | null;
  nextRunAt: string | null;
  /** 0 to 100, how far through the current wait. */
  progress: number | null;
  runsPerDay: string;
  sourceCount: number | null;
}

export interface KpiView {
  label: string;
  value: string;
  delta: string;
  deltaTone: "crit" | "ok" | "muted";
  meaning: string;
  source: string;
}

export interface CountsView {
  act_now: number;
  watch: number;
  low: number;
  total: number;
}

export interface RealItem {
  title: string;
  text: string;
}

export interface NoiseItem {
  title: string;
  tag: string;
  text: string;
}

export interface DoItem {
  lead: string;
  text: string;
}

export interface DriverBar {
  label: string;
  value: string;
  pct: number;
  tone: "accent" | "warn" | "crit";
}

export interface StatView {
  value: string;
  text: string;
  source: string;
}

export interface HomeData {
  status: StatusView;
  weekOf: string;
  hero: {
    id: string;
    href: string;
    title: string;
    verdict: Verdict;
    idsLabel: string;
    blurb: string;
  } | null;
  counts: CountsView;
  countsNote: string;
  kpis: KpiView[];
  real: RealItem[];
  noise: NoiseItem[];
  actions: DoItem[];
  events: EventRow[];
  /** Events tracked in total, so the home table can point to the full list. */
  totalEvents: number;
  drivers: { paragraphs: { lead: string; text: string }[]; bars: DriverBar[]; barsTitle: string; barsCaption: string; barsSource: string };
  ransomware: StatView[];
}

export interface BriefData {
  weekOf: string;
  bottomLine: string;
  counts: CountsView;
  changes: { lead: string; text: string }[];
  flagship: { title: string; ladder: Ladder } | null;
  position: { item: string; status: string; note: string }[];
  notConcern: string;
  questions: string[];
  sourcesLine: string;
}

export type VerdictFilter = Verdict | "all";

export interface EventsIndexData {
  status: StatusView;
  mode: DataMode;
  filter: VerdictFilter;
  /** Counts over every visible event, ignoring the filter. */
  counts: CountsView;
  rows: EventRow[];
  /** Events matching the filter. */
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

export interface CorrectionView {
  id: number;
  /** ISO timestamp. */
  at: string;
  eventId: string | null;
  /** Set only when the event is still public. */
  eventTitle: string | null;
  eventHref: string | null;
  text: string;
}
