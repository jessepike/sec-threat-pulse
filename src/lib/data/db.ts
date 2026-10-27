import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { RUNGS, type ExploitMaturity, type Ladder, type RungState, type Verdict } from "@/lib/ladder/types";
import { RUNG_SHORT, topConfirmed } from "./sample";
import { firstQuestion, questionLines } from "@/lib/narrative/model";
import { homeSelection, paginateListed, sortListed, type Listable } from "./listing";
import { isoDayPT, joinSentences } from "./format";
import { productName } from "@/lib/ladder/plain-title";
import { categorize } from "@/lib/ladder/category";
import type { ClaimView, CorrectionView, CountsView, EventRow, EventView, RungView, SourceRef, StatusView, TimelineItem, VerdictFilter } from "./types";

type Db = NonNullable<ReturnType<typeof getDb>>;

function asVerdict(v: string | null | undefined): Verdict {
  return v === "act_now" || v === "watch" ? v : "low";
}

function asLadder(raw: Record<string, string> | null | undefined): Ladder {
  const out = {} as Ladder;
  for (const r of RUNGS) {
    const v = raw?.[r];
    out[r] = v === "confirmed" || v === "reported" ? (v as RungState) : "none";
  }
  return out;
}

function isoOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function idsLabel(cves: string[]): string {
  if (cves.length === 0) return "No CVE yet";
  if (cves.length === 1) return cves[0];
  if (cves.length === 2) return `${cves[0]} / -${cves[1].split("-").slice(2).join("-")}`;
  return `${cves[0]} and ${cves.length - 1} more`;
}

async function cvesByEvent(db: Db, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = await db.select().from(schema.eventCves).where(inArray(schema.eventCves.eventId, ids));
  for (const r of rows) map.set(r.eventId, [...(map.get(r.eventId) ?? []), r.cveId]);
  for (const [k, v] of map) map.set(k, v.sort());
  return map;
}

type EventRecord = typeof schema.events.$inferSelect;
type NarrativeRecord = typeof schema.eventNarratives.$inferSelect;

/** Only published narratives reach public pages. */
async function publishedNarratives(db: Db, ids: string[]): Promise<Map<string, NarrativeRecord>> {
  const map = new Map<string, NarrativeRecord>();
  if (ids.length === 0) return map;
  const rows = await db
    .select()
    .from(schema.eventNarratives)
    .where(and(inArray(schema.eventNarratives.eventId, ids), eq(schema.eventNarratives.status, "published")));
  for (const r of rows) map.set(r.eventId, r);
  return map;
}

/** The first sentence, cut at a word near `max` characters, for list views. Event pages show the full text. */
export function firstSentence(text: string, max = 170): string {
  const t = text.replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const first = m && m[1].length >= 40 ? m[1] : t;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/** A factual starter question when no one has written one: does the team run the product, and is it fixed? */
export function defaultQuestion(vendor: string | null, product: string | null): string | null {
  const name = productName(vendor, product);
  return name ? `Do we run ${name}? If yes, is it patched or cut off from the internet?` : null;
}

/** Factual starter questions for an event page with no written ones. */
export function starterQuestions(vendor: string | null, product: string | null): string[] | undefined {
  const first = defaultQuestion(vendor, product);
  if (!first) return undefined;
  return [first, "Who owns fixing it, and by what date?", "Have we checked for signs of attack since the first report, not just since the patch?"];
}

function toRow(e: EventRecord, cves: string[], n?: Pick<NarrativeRecord, "askYourTeam">): EventRow {
  const ladder = asLadder(e.ladder);
  const verdict = asVerdict(e.overrideVerdict ?? e.verdict);
  const cat = categorize(e.vendor, e.product);
  const vendor = productName(e.vendor, null) || undefined;
  return {
    vendor,
    category: { id: cat.id, label: cat.label, doThis: cat.doThis },
    id: e.id,
    href: `/events/${e.id}`,
    title: e.titleOverride ?? e.title,
    idsLabel: idsLabel(cves),
    exposure: cat.why || (e.summary ? firstSentence(e.summary) : "No summary written yet."),
    question: firstQuestion(n?.askYourTeam) ?? defaultQuestion(e.vendor, e.product),
    verdict,
    ladder,
    topConfirmed: topConfirmed(ladder),
  };
}

export interface EventSummary {
  row: EventRow;
  summary: string;
  updatedAt: string;
  cvss?: number;
}

export interface Rec {
  e: EventRecord;
  verdict: Verdict;
  evidenceAt: number;
  signalAt?: number;
  reports: number;
}

/** Every visible event with its report count and newest evidence time, in display order. */
export async function loadRecords(db: Db): Promise<Rec[]> {
  const agg = db
    .select({
      eventId: schema.observations.eventId,
      n: sql<number>`count(*)`.as("n"),
      latest: sql<string | Date | null>`max(coalesce(${schema.observations.publishedAt}, ${schema.observations.observedAt}))`.as("latest"),
      // Newest dated report of attacks, exploitation or damage. Ingest time does not count.
      signal: sql<string | Date | null>`max(${schema.observations.publishedAt}) filter (where ${schema.observations.kind} in ('attempts', 'exploited', 'damage'))`.as("signal"),
    })
    .from(schema.observations)
    .where(isNotNull(schema.observations.eventId))
    .groupBy(schema.observations.eventId)
    .as("agg");
  const rows = await db
    .select({ e: schema.events, n: agg.n, latest: agg.latest, signal: agg.signal })
    .from(schema.events)
    .leftJoin(agg, eq(agg.eventId, schema.events.id))
    .where(eq(schema.events.hidden, false));
  const recs = rows.map((r): Rec => {
    const latest = r.latest ? new Date(r.latest).getTime() : NaN;
    const signal = r.signal ? new Date(r.signal).getTime() : NaN;
    return {
      signalAt: Number.isFinite(signal) ? signal : undefined,
      e: r.e,
      verdict: asVerdict(r.e.overrideVerdict ?? r.e.verdict),
      evidenceAt: Number.isFinite(latest) ? latest : r.e.updatedAt.getTime(),
      reports: Number(r.n ?? 0),
    };
  });
  return sortListed(recs.map((r) => ({ ...r, id: r.e.id }))).map(({ e, verdict, evidenceAt, signalAt, reports }) => ({ e, verdict, evidenceAt, signalAt, reports }));
}

const listable = (r: Rec): Listable => ({ id: r.e.id, verdict: r.verdict, evidenceAt: r.evidenceAt, signalAt: r.signalAt, reports: r.reports });

async function summarize(db: Db, recs: Rec[]): Promise<EventSummary[]> {
  const rows = recs.map((r) => r.e);
  const ids = rows.map((r) => r.id);
  const cves = await cvesByEvent(db, ids);
  const narratives = await publishedNarratives(db, ids);
  const all = [...cves.values()].flat();
  const vulns = all.length ? await db.select({ cveId: schema.vulnerabilities.cveId, cvss: schema.vulnerabilities.cvssScore }).from(schema.vulnerabilities).where(inArray(schema.vulnerabilities.cveId, all)) : [];
  const cvssOf = new Map(vulns.map((v) => [v.cveId, v.cvss]));
  return rows.map((e) => {
    const list = cves.get(e.id) ?? [];
    const scores = list.map((c) => cvssOf.get(c)).filter((x): x is number => typeof x === "number");
    return { row: toRow(e, list, narratives.get(e.id)), summary: e.summary ?? "", updatedAt: e.updatedAt.toISOString(), cvss: scores.length ? Math.max(...scores) : undefined };
  });
}

function countsOf(recs: Rec[]): CountsView {
  return countVerdicts(recs.map((r) => ({ verdict: r.verdict })));
}

/** Home page events: Act now with evidence in the last 30 days, up to 12 Watch and 6 Low, early Watch events need 2+ reports. */
export async function dbHomeEvents(): Promise<{ counts: CountsView; items: EventSummary[] }> {
  const db = getDb();
  if (!db) return { counts: countVerdicts([]), items: [] };
  const recs = await loadRecords(db);
  const keep = new Set(homeSelection(recs.map(listable)).map((x) => x.id));
  return { counts: countsOf(recs), items: await summarize(db, recs.filter((r) => keep.has(r.e.id))) };
}

/** One page of the /events index. Hidden events never appear. */
export async function dbEventsPage(filter: VerdictFilter, page: number) {
  const db = getDb();
  if (!db) return { counts: countVerdicts([]), rows: [] as EventRow[], total: 0, page: 1, pages: 1 };
  const recs = await loadRecords(db);
  const byId = new Map(recs.map((r) => [r.e.id, r]));
  const p = paginateListed(recs.map(listable), filter, page);
  const items = await summarize(db, p.items.map((x) => byId.get(x.id)!));
  return { counts: countsOf(recs), rows: items.map((x) => x.row), total: p.total, page: p.page, pages: p.pages };
}

/** Inputs for the board brief: counts, the lead event and events updated in the last 7 days. */
export async function dbBriefEvents(): Promise<{ counts: CountsView; top: EventSummary | null; recent: EventSummary[] }> {
  const db = getDb();
  if (!db) return { counts: countVerdicts([]), top: null, recent: [] };
  const recs = await loadRecords(db);
  const week = Date.now() - 7 * 86_400_000;
  const recentRecs = recs.filter((r) => r.e.updatedAt.getTime() >= week).slice(0, 3);
  const wanted = recs.length ? [recs[0], ...recentRecs.filter((r) => r.e.id !== recs[0].e.id)] : [];
  const sums = await summarize(db, wanted);
  const byId = new Map(sums.map((x) => [x.row.id, x]));
  return {
    counts: countsOf(recs),
    top: recs.length ? (byId.get(recs[0].e.id) ?? null) : null,
    recent: recentRecs.map((r) => byId.get(r.e.id)).filter((x): x is EventSummary => !!x),
  };
}

/** Ids and update times of every visible event, for the sitemap. */
export async function dbEventEntries(): Promise<{ id: string; updatedAt: string }[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select({ id: schema.events.id, updatedAt: schema.events.updatedAt }).from(schema.events).where(eq(schema.events.hidden, false)).orderBy(desc(schema.events.updatedAt));
  return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt.toISOString() }));
}

/** The public corrections log, newest first. The editor login is never returned. */
export async function dbCorrections(): Promise<CorrectionView[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ c: schema.corrections, title: sql<string>`coalesce(${schema.events.titleOverride}, ${schema.events.title})`, hidden: schema.events.hidden })
    .from(schema.corrections)
    .leftJoin(schema.events, eq(schema.events.id, schema.corrections.eventId))
    .orderBy(desc(schema.corrections.createdAt), desc(schema.corrections.id));
  return rows.map(({ c, title, hidden }) => {
    const visible = !!c.eventId && title != null && hidden === false;
    return {
      id: c.id,
      at: c.createdAt.toISOString(),
      eventId: c.eventId,
      eventTitle: visible ? title : null,
      eventHref: visible ? `/events/${c.eventId}` : null,
      text: c.text,
    };
  });
}

export function countVerdicts(rows: { verdict: Verdict }[]): CountsView {
  const c: CountsView = { act_now: 0, watch: 0, low: 0, total: rows.length };
  for (const r of rows) c[r.verdict] += 1;
  return c;
}

export async function dbStatus(): Promise<StatusView> {
  const db = getDb();
  const base: StatusView = { mode: "live", lastRunAt: null, nextRunAt: null, progress: null, runsPerDay: "4+ RUNS / DAY", sourceCount: null };
  if (!db) return base;
  const rows = await db.select().from(schema.sources).where(eq(schema.sources.enabled, true));
  if (rows.length === 0) return base;
  let last: Date | null = null;
  let next: Date | null = null;
  for (const s of rows) {
    const l = s.lastSuccessAt ?? s.lastRunAt;
    if (l && (!last || l > last)) last = l;
    if (l) {
      const due = new Date(l.getTime() + s.intervalMinutes * 60_000);
      if (!next || due < next) next = due;
    }
  }
  let progress: number | null = null;
  if (last && next && next > last) {
    progress = Math.min(100, Math.max(0, Math.round(((Date.now() - last.getTime()) / (next.getTime() - last.getTime())) * 100)));
  }
  return { ...base, lastRunAt: isoOrNull(last), nextRunAt: isoOrNull(next), progress, sourceCount: rows.length };
}

/** Count of CISA KEV additions in the last 7 and 30 days, from vulnerability facts. */
export async function dbKevCounts(): Promise<{ d7: number; d30: number }> {
  const db = getDb();
  if (!db) return { d7: 0, d30: 0 };
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const [r] = await db
    .select({
      d7: sql<number>`count(*) filter (where ${schema.vulnerabilities.kevCisaDateAdded} >= ${day(7)})`,
      d30: sql<number>`count(*) filter (where ${schema.vulnerabilities.kevCisaDateAdded} >= ${day(30)})`,
    })
    .from(schema.vulnerabilities)
    .where(gte(schema.vulnerabilities.kevCisaDateAdded, day(30)));
  return { d7: Number(r?.d7 ?? 0), d30: Number(r?.d30 ?? 0) };
}

/**
 * When no one has written a fix, restate CISA's own instruction and deadline from the KEV entries.
 * Every part comes from the catalog: the required action, the federal due date and the ransomware flag.
 */
export function kevFix(obs: { sourceId: string; metadata?: unknown }[], now: Date = new Date()): string | undefined {
  const kev = obs.filter((o) => o.sourceId === "cisa-kev");
  if (!kev.length) return undefined;
  const meta = kev.map((o) => (o.metadata ?? {}) as { dueDate?: string; ransomware?: string });
  const due = meta
    .map((m) => m.dueDate)
    .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()[0];
  const parts = ["CISA's instruction: apply the vendor's fix, or stop using the product if no fix exists."];
  if (due) {
    const d = new Date(`${due}T12:00:00Z`);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    const today = now.toISOString().slice(0, 10);
    parts.push(due < today ? `The deadline for US federal agencies, ${label}, has passed.` : `US federal agencies must do this by ${label}.`);
  }
  if (meta.some((m) => m.ransomware === "Known")) parts.push("CISA reports that ransomware groups use this flaw.");
  return parts.join(" ");
}

export async function dbEvent(id: string): Promise<EventView | null> {
  const db = getDb();
  if (!db) return null;
  const [e] = await db.select().from(schema.events).where(and(eq(schema.events.id, id), eq(schema.events.hidden, false))).limit(1);
  if (!e) return null;
  const cveRows = await db.select().from(schema.eventCves).where(eq(schema.eventCves.eventId, id));
  const cves = cveRows.map((c) => c.cveId).sort();
  const vulns = cves.length ? await db.select().from(schema.vulnerabilities).where(inArray(schema.vulnerabilities.cveId, cves)) : [];
  const obs = await db
    .select({ o: schema.observations, sourceName: schema.sources.name, sourceHome: schema.sources.homepage })
    .from(schema.observations)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.observations.sourceId))
    .where(eq(schema.observations.eventId, id))
    .orderBy(desc(schema.observations.publishedAt));

  const ref = (x: (typeof obs)[number]): SourceRef => ({
    label: x.sourceName ? `${x.sourceName}: ${x.o.title}` : x.o.title,
    url: x.o.url,
    at: isoOrNull(x.o.publishedAt ?? x.o.observedAt) ?? undefined,
  });

  const ladder = asLadder(e.ladder);
  const rungViews: RungView[] = RUNGS.map((r, i) => {
    const mine = obs.filter((x) => x.o.kind === r);
    const entailed = r === "attempts" && !mine.length && ladder.exploited !== "none" && ladder[r] !== "none";
    const text = mine.length
      ? joinSentences(mine.slice(0, 2).map((x) => x.o.summary || x.o.title))
      : ladder[r] === "none"
        ? "No evidence yet."
        : entailed
          ? `Attacks that worked are ${ladder.exploited} (step 4), so attempts count as ${ladder[r]} too.`
          : "Evidence is recorded but no summary is available.";
    const times = mine.map((x) => x.o.publishedAt ?? x.o.observedAt).filter(Boolean).map((d) => d.getTime());
    const newestAt = times.length ? new Date(Math.max(...times)).toISOString() : undefined;
    return { rung: r, num: String(i + 1).padStart(2, "0"), step: RUNG_SHORT[r], state: ladder[r], evidence: text, sources: mine.slice(0, 4).map(ref), newestAt };
  });

  const [narrative] = (await publishedNarratives(db, [id])).values();
  const leakClaims: ClaimView[] = obs
    .filter((x) => x.o.kind === "claim")
    .slice(0, 8)
    .map((x) => ({ claim: x.o.orgName ? `${x.o.orgName} (listed by a leak site)` : x.o.title, truth: x.o.summary || "A criminal group made this claim. It has not been verified.", rating: "UNVERIFIED" as const }));
  const claims: ClaimView[] = [...(narrative?.claimChecks ?? []), ...leakClaims];
  const roleLabels = [["CISO", "ciso"], ["CIO", "cio"], ["CEO", "ceo"], ["BOARD", "board"]] as const;
  const roles = narrative ? roleLabels.map(([role, k]) => ({ role, items: narrative.roles[k] ?? [] })).filter((r) => r.items.length > 0) : [];

  const timeline: TimelineItem[] = obs
    .filter((x) => x.o.publishedAt)
    .sort((a, b) => a.o.publishedAt!.getTime() - b.o.publishedAt!.getTime())
    .slice(0, 12)
    .map((x) => ({ when: isoDayPT(new Date(x.o.publishedAt!)), what: x.o.title, hot: x.o.kind === "attempts" || x.o.kind === "exploited" || x.o.kind === "damage" }));

  const scores = vulns.map((v) => v.cvssScore).filter((n): n is number => typeof n === "number");
  const kev = vulns.some((v) => v.kevCisaDateAdded);
  const top = topConfirmed(ladder);
  const row = toRow(e, cves, narrative);
  const sourceMap = new Map<string, SourceRef>();
  for (const x of obs) if (!sourceMap.has(x.o.url)) sourceMap.set(x.o.url, ref(x));

  const technicalNames = [...new Set(vulns.map((v) => v.title?.trim()).filter((t): t is string => !!t && t !== row.title))].slice(0, 3);

  return {
    ...row,
    cves,
    technicalNames: technicalNames.length ? technicalNames : undefined,
    cvss: scores.length ? Math.max(...scores) : undefined,
    summary: e.summary ?? "",
    verdictReason: e.overrideReason ?? e.verdictReason ?? undefined,
    exploitMaturity: (e.exploitMaturity as ExploitMaturity) ?? "none",
    facts: [
      { label: "HIGHEST CONFIRMED RUNG", value: top ? RUNG_SHORT[top] : "NOTHING YET" },
      { label: "CISA KEV", value: kev ? "LISTED" : "NOT YET" },
      { label: "EXPLOIT CODE", value: e.exploitMaturity === "weaponized" ? "READY TO USE" : e.exploitMaturity === "poc" ? "PROOF OF CONCEPT" : "NONE KNOWN" },
    ],
    rungs: rungViews,
    claims,
    timeline,
    roles,
    businessTerms: narrative?.businessExposure?.trim() || categorize(e.vendor, e.product).why || undefined,
    doThis: categorize(e.vendor, e.product).doThis,
    whyAct: narrative?.whyAct?.trim() || undefined,
    fix: narrative?.fix?.trim() || kevFix(obs.map((x) => x.o)),
    askYourTeam: narrative && questionLines(narrative.askYourTeam).length ? questionLines(narrative.askYourTeam) : starterQuestions(e.vendor, e.product),
    aiDrafted: narrative?.source === "ai_draft",
    sources: [...sourceMap.values()],
    updatedAt: e.updatedAt.toISOString(),
    trackingSince: e.firstSeenAt.toISOString(),
  };
}

export async function dbSourceCountForEvent(id: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [r] = await db
    .select({ n: sql<number>`count(distinct ${schema.observations.sourceId})` })
    .from(schema.observations)
    .where(eq(schema.observations.eventId, id));
  return Number(r?.n ?? 0);
}
