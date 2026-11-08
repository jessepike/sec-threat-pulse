import type { ExploitMaturity, Ladder, Rung, Verdict } from "@/lib/ladder/types";
import type { ActTier } from "@/lib/ladder/rules";

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

/** A product chip on lists and event pages. */
export interface ProductChip {
  /** "Fortinet FortiOS". */
  label: string;
  /** Filter key, for example "fortinet/fortios". */
  slug: string;
  kind: "direct" | "embedded";
  /** For embedded products, the component they ship and the page that says so. */
  via?: string;
  ref?: string;
}

/** One dated point on the event's clock, with the source that set it. */
export interface ClockPointView {
  key: "disclosed" | "exploitCode" | "firstReport" | "kevListed" | "kevDue";
  label: string;
  /** YYYY-MM-DD, or undefined when the date is not known. */
  date?: string;
  source?: string;
  url?: string;
}

export interface ClockView {
  points: ClockPointView[];
  /** One plain sentence, for example "Attacks were reported 2 days after disclosure." */
  note?: string;
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
  /** Distinct sources behind this rung. */
  sourceCount?: number;
  /** Set when the rung has no evidence and no source we use can fill it: why. */
  untracked?: string;
}

export interface EventRow {
  id: string;
  href: string;
  title: string;
  idsLabel: string;
  exposure: string;
  question: string | null;
  verdict: Verdict;
  /** Tier inside Act now from the rules version, when it sets one (v3 on). */
  tier?: ActTier;
  ladder: Ladder;
  topConfirmed: Rung | null;
  /** Vendor name as shown, for the "vendors I use" filter. */
  vendor?: string;
  /** Plain category of system and its first step, from the fixed table in lib/ladder/category. */
  category?: { id: string; label: string; doThis: string };
  /** Affected products, direct first, then products that ship the component. */
  products?: ProductChip[];
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
  /** The official names of the flaws (CISA or CVE record titles), shown under the plain title. */
  technicalNames?: string[];
  cvss?: number;
  summary: string;
  verdictReason?: string;
  /** One line per ranking factor, from the rules version (v3 on). */
  rankWhy?: string[];
  exploitMaturity: ExploitMaturity;
  facts: Fact[];
  rungs: RungView[];
  clock?: ClockView;
  verdictChangesIf?: string;
  businessTerms?: string;
  whyAct?: string;
  /** The first step for this kind of system, from the category table. */
  doThis?: string;
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
  /** Link to the page the figure comes from. Required for report figures. */
  sourceUrl?: string;
  /** Publication date of that page, YYYY-MM-DD. */
  asOf?: string;
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

export interface SourceLink {
  label: string;
  url: string;
}

export interface DriverParagraph {
  lead: string;
  text: string;
  src?: SourceLink;
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
  sourceUrl?: string;
  /** Publication date of the source page, YYYY-MM-DD. */
  asOf?: string;
}

export interface HomeData {
  status: StatusView;
  weekOf: string;
  /** Up to five Act now events in rank order: the home page's first list. */
  top: { rank: number; row: EventRow }[];
  /** One sentence for the week, from fixed templates. */
  weekLine: string;
  counts: CountsView;
  countsNote: string;
  kpis: KpiView[];
  real: RealItem[];
  noise: NoiseItem[];
  actions: DoItem[];
  events: EventRow[];
  /** Events tracked in total, so the home table can point to the full list. */
  totalEvents: number;
  drivers: { paragraphs: DriverParagraph[]; bars: DriverBar[]; barsTitle: string; barsCaption: string; barsSources: SourceLink[] };
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
  /** Product filter as given in the URL, when set. */
  product?: string;
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
