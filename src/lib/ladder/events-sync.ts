import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { eventCves, events, observations, verdictHistory, vulnerabilities } from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { ladderEquals } from "./compute";
import {
  buildEarlyEvents,
  buildEvents,
  DEFAULT_LOOKBACK_DAYS,
  EARLY_PREFIX,
  EARLY_WINDOW_DAYS,
  MAX_NEW_EARLY_EVENTS_PER_RUN,
  type ComputedEvent,
  type EventObservation,
  type EventVuln,
} from "./events";
import { CURRENT_RULES_VERSION } from "./rules";
import { plainTitle } from "./plain-title";
import type { ObservationKind, ObservationStrength } from "./types";

export interface SyncOptions {
  now?: Date;
  lookbackDays?: number;
  rulesVersion?: string;
  /** New early events created per run. Defaults to MAX_NEW_EARLY_EVENTS_PER_RUN. */
  maxNewEarly?: number;
}

export interface SyncSummary {
  considered: number;
  created: number;
  updated: number;
  unchanged: number;
  verdictChanges: number;
  observationsAttached: number;
  eventsHidden: number;
  /** CVEs with early evidence and no KEV listing this run. */
  earlyCandidates: number;
  /** Early events not created this run because of the per run cap. They are picked up next run. */
  earlyDeferred: number;
  /** Early candidates left out because the CVE publish date is not known yet. */
  earlySkippedNoAge: number;
}

const CHUNK = 300;

/** JSON with sorted keys and no undefined fields, so a value read back from jsonb compares equal to the one computed. */
function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([, y]) => y !== undefined).sort(([a], [b]) => a.localeCompare(b))) : x));
}
const chunks = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

/** Automatic events: KEV events and early (pre-listing) events. Anything else is admin owned. */
const AUTO_PREFIXES = ["kev-", EARLY_PREFIX];
const isAuto = (id: string) => AUTO_PREFIXES.some((p) => id.startsWith(p));
const autoLike = (col: typeof events.id | typeof eventCves.eventId) => or(...AUTO_PREFIXES.map((p) => like(col, `${p}%`)))!;

const OBS_COLUMNS = {
  id: observations.id,
  sourceId: observations.sourceId,
  kind: observations.kind,
  strength: observations.strength,
  cveIds: observations.cveIds,
  metadata: observations.metadata,
  eventId: observations.eventId,
  publishedAt: observations.publishedAt,
  observedAt: observations.observedAt,
};

type ObsRow = EventObservation & { eventId: string | null; publishedAt: Date | null; observedAt: Date };

async function loadObservationsFor(db: Db, cves: string[]): Promise<ObsRow[]> {
  const out: ObsRow[] = [];
  for (const part of chunks(cves, 400)) {
    const list = sql.join(part.map((c) => sql`${c}`), sql`, `);
    const rows = await db.select(OBS_COLUMNS).from(observations).where(sql`${observations.cveIds} ?| array[${list}]::text[]`);
    for (const r of rows) out.push({ ...r, kind: r.kind as ObservationKind, strength: r.strength as ObservationStrength });
  }
  return [...new Map(out.map((o) => [o.id, o])).values()];
}

/**
 * CVEs with early evidence (exploitation reported or confirmed, or confirmed attack attempts) in
 * the window and no KEV listing. Shared with the ingest runner so these CVEs get enriched.
 */
export async function loadEarlyCandidateCves(db: Db, now: Date, limit = 200): Promise<string[]> {
  const since = new Date(now.getTime() - EARLY_WINDOW_DAYS * 86400000);
  const res = await db.execute(sql`
    select upper(c.cve) as cve, count(*)::int as n
    from observations o
    cross join lateral jsonb_array_elements_text(o.cve_ids) as c(cve)
    where ((o.kind = 'exploited' and o.strength in ('reported', 'confirmed')) or (o.kind = 'attempts' and o.strength = 'confirmed'))
      and coalesce(o.published_at, o.observed_at) >= ${since.toISOString()}::timestamptz
      and not exists (
        select 1 from vulnerabilities v
        where upper(v.cve_id) = upper(c.cve) and (v.kev_cisa_date_added is not null or v.kev_vulncheck_date_added is not null)
      )
    group by 1
    order by n desc, cve
    limit ${limit}`);
  const rows = ((res as unknown as { rows?: { cve: string }[] }).rows ?? (res as unknown as { cve: string }[]));
  return rows.map((r) => r.cve);
}

/**
 * Rebuild automatic (KEV) events from vulnerabilities and observations. Idempotent.
 * Writes events, event_cves, observations.event_id and verdict_history (only when the verdict
 * or the ladder changes, or when an event is first created). Admin created events (ids that do
 * not start with `kev-`) are never touched, and admin overrides are kept.
 */
export async function syncEvents(db: Db, opts: SyncOptions = {}): Promise<SyncSummary> {
  const now = opts.now ?? new Date();
  const lookback = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const rulesVersion = opts.rulesVersion ?? CURRENT_RULES_VERSION;
  const summary: SyncSummary = { considered: 0, created: 0, updated: 0, unchanged: 0, verdictChanges: 0, observationsAttached: 0, eventsHidden: 0, earlyCandidates: 0, earlyDeferred: 0, earlySkippedNoAge: 0 };

  // Early events that already exist, so a later KEV listing can adopt them.
  const earlyRows = await db
    .select({ id: events.id, firstSeenAt: events.firstSeenAt, cveId: eventCves.cveId })
    .from(events)
    .innerJoin(eventCves, eq(eventCves.eventId, events.id))
    .where(like(events.id, `${EARLY_PREFIX}%`));
  const earlyExisting = new Map<string, { id: string; cveIds: string[]; firstSeenAt: string }>();
  for (const r of earlyRows) {
    const e = earlyExisting.get(r.id) ?? { id: r.id, cveIds: [], firstSeenAt: r.firstSeenAt.toISOString() };
    e.cveIds.push(r.cveId.toUpperCase());
    earlyExisting.set(r.id, e);
  }

  // 1) KEV events (a margin beyond the lookback keeps a straddling cluster whole).
  const loadFrom = new Date(now.getTime() - (lookback + 30) * 86400000).toISOString().slice(0, 10);
  const vulnRows = await db
    .select()
    .from(vulnerabilities)
    .where(sql`${vulnerabilities.kevCisaDateAdded} >= ${loadFrom} or ${vulnerabilities.kevVulncheckDateAdded} >= ${loadFrom}`);
  const vulns: EventVuln[] = vulnRows;
  const kevObs = vulnRows.length ? await loadObservationsFor(db, vulnRows.map((v) => v.cveId)) : [];
  const kevComputed = vulnRows.length ? buildEvents(vulns, kevObs, { now, lookbackDays: lookback, rulesVersion, earlyEvents: [...earlyExisting.values()] }) : [];

  // 2) Early events: exploitation reported or confirmed attempts, no KEV listing yet.
  const kevCves = new Set(kevComputed.flatMap((e) => e.cveIds));
  const candidateCves = (await loadEarlyCandidateCves(db, now)).filter((c) => !kevCves.has(c));
  summary.earlyCandidates = candidateCves.length;
  const earlyComputed: ComputedEvent[] = [];
  let earlyObs: ObsRow[] = [];
  if (candidateCves.length) {
    const vrows: EventVuln[] = [];
    for (const part of chunks(candidateCves, 400)) vrows.push(...(await db.select().from(vulnerabilities).where(inArray(vulnerabilities.cveId, part))));
    const have = new Set(vrows.map((v) => v.cveId.toUpperCase()));
    for (const c of candidateCves) if (!have.has(c)) vrows.push({ cveId: c });
    earlyObs = await loadObservationsFor(db, candidateCves);
    const built = buildEarlyEvents(vrows, earlyObs, { now, rulesVersion });
    summary.earlySkippedNoAge = built.skippedNoAge.length;
    const present = new Set<string>();
    for (let i = 0; i < built.events.length; i += CHUNK) {
      for (const r of await db.select({ id: events.id }).from(events).where(inArray(events.id, built.events.slice(i, i + CHUNK).map((e) => e.id)))) present.add(r.id);
    }
    const cap = opts.maxNewEarly ?? MAX_NEW_EARLY_EVENTS_PER_RUN;
    let fresh = 0;
    for (const e of built.events) {
      if (!present.has(e.id)) {
        if (fresh >= cap) {
          summary.earlyDeferred++;
          continue;
        }
        fresh++;
      }
      earlyComputed.push(e);
    }
  }

  const computed = [...kevComputed, ...earlyComputed];
  const uniqueObs = [...new Map([...kevObs, ...earlyObs].map((o) => [o.id, o])).values()];
  summary.considered = computed.length;
  if (!computed.length) return summary;

  const ids = computed.map((e) => e.id);
  const existing = new Map<string, typeof events.$inferSelect>();
  for (const part of chunks(ids, CHUNK)) {
    for (const r of await db.select().from(events).where(inArray(events.id, part))) existing.set(r.id, r);
  }

  const toCreate: ComputedEvent[] = [];
  const toUpdate: { e: ComputedEvent; ladderOrVerdictChanged: boolean }[] = [];
  for (const e of computed) {
    const cur = existing.get(e.id);
    if (!cur) {
      toCreate.push(e);
      continue;
    }
    const ladderChanged = !ladderEquals(cur.ladder, e.ladder);
    const verdictChanged = cur.verdict !== e.verdict;
    const fieldsChanged =
      cur.title !== e.title ||
      (cur.summary ?? undefined) !== e.summary ||
      (cur.vendor ?? undefined) !== e.vendor ||
      (cur.product ?? undefined) !== e.product ||
      stableJson(cur.affectedProducts ?? []) !== stableJson(e.affectedProducts) ||
      cur.exploitMaturity !== e.exploitMaturity ||
      cur.verdictReason !== e.verdictReason ||
      (cur.tier ?? undefined) !== e.tier ||
      (cur.rankScore ?? undefined) !== e.rankScore ||
      stableJson(cur.rankWhy ?? undefined) !== stableJson(e.rankWhy) ||
      cur.rulesVersion !== e.rulesVersion;
    if (ladderChanged || verdictChanged || fieldsChanged) toUpdate.push({ e, ladderOrVerdictChanged: ladderChanged || verdictChanged });
    else summary.unchanged++;
  }

  const row = (e: ComputedEvent) => ({
    title: e.title,
    summary: e.summary,
    vendor: e.vendor,
    product: e.product,
    affectedProducts: e.affectedProducts,
    ladder: e.ladder as Record<string, string>,
    exploitMaturity: e.exploitMaturity,
    verdict: e.verdict,
    verdictReason: e.verdictReason,
    tier: e.tier ?? null,
    rankScore: e.rankScore ?? null,
    rankWhy: e.rankWhy ?? null,
    rulesVersion: e.rulesVersion,
  });
  const history = (e: ComputedEvent) => ({
    eventId: e.id,
    verdict: e.verdict,
    ladder: e.ladder as Record<string, string>,
    rulesVersion: e.rulesVersion,
    reason: e.verdictReason,
    actor: "rules",
  });

  // 1) New events and their first history rows.
  for (const part of chunks(toCreate, 100)) {
    await db.insert(events).values(part.map((e) => ({ id: e.id, ...row(e), kind: "vulnerability", firstSeenAt: new Date(e.firstSeenAt), updatedAt: now }))).onConflictDoNothing();
    await db.insert(verdictHistory).values(part.map(history));
    summary.created += part.length;
    summary.verdictChanges += part.length;
  }

  // 2) Changed events. History only when the verdict or the ladder moved.
  const historyRows: ReturnType<typeof history>[] = [];
  for (const { e, ladderOrVerdictChanged } of toUpdate) {
    await db.update(events).set({ ...row(e), updatedAt: now }).where(eq(events.id, e.id));
    if (ladderOrVerdictChanged) historyRows.push(history(e));
    summary.updated++;
  }
  for (const part of chunks(historyRows, 100)) await db.insert(verdictHistory).values(part);
  summary.verdictChanges += historyRows.length;

  // 3) event_cves: add missing, remove CVEs that moved to another automatic event.
  const wanted = new Set(computed.flatMap((e) => e.cveIds.map((c) => `${e.id}|${c}`)));
  const have: { eventId: string; cveId: string }[] = [];
  for (const part of chunks(ids, CHUNK)) have.push(...(await db.select().from(eventCves).where(inArray(eventCves.eventId, part))));
  const haveKeys = new Set(have.map((h) => `${h.eventId}|${h.cveId}`));
  const missing = computed.flatMap((e) => e.cveIds.filter((c) => !haveKeys.has(`${e.id}|${c}`)).map((cveId) => ({ eventId: e.id, cveId })));
  for (const part of chunks(missing, 500)) await db.insert(eventCves).values(part).onConflictDoNothing();
  const extra = have.filter((h) => !wanted.has(`${h.eventId}|${h.cveId}`));
  const emptied = new Map<string, string[]>();
  const release = (eventId: string, cveId: string) => emptied.set(eventId, [...(emptied.get(eventId) ?? []), cveId.toUpperCase()]);
  for (const x of extra) {
    await db.delete(eventCves).where(and(eq(eventCves.eventId, x.eventId), eq(eventCves.cveId, x.cveId)));
    release(x.eventId, x.cveId);
  }
  // Automatic events outside this rebuild that still hold CVEs now owned by a rebuilt event
  // (two clusters merged because a bridging CVE arrived). Release those CVEs.
  const allCves = [...new Set(computed.flatMap((e) => e.cveIds))];
  const idSet = new Set(ids);
  for (const part of chunks(allCves, CHUNK)) {
    const stale = await db
      .select()
      .from(eventCves)
      .where(and(inArray(eventCves.cveId, part), autoLike(eventCves.eventId)));
    for (const x of stale) {
      if (idSet.has(x.eventId)) continue;
      await db.delete(eventCves).where(and(eq(eventCves.eventId, x.eventId), eq(eventCves.cveId, x.cveId)));
      release(x.eventId, x.cveId);
    }
  }

  // 4) Observation to event links. Admin assigned links (non automatic ids) are kept.
  const eventOfObs = new Map<number, string>();
  for (const e of computed) for (const id of e.observationIds) if (!eventOfObs.has(id)) eventOfObs.set(id, e.id);
  const attach = uniqueObs.filter((o) => {
    const target = eventOfObs.get(o.id);
    if (!target || o.eventId === target) return false;
    return o.eventId === null || isAuto(o.eventId);
  });
  for (const part of chunks(attach, 500)) {
    const values = sql.join(part.map((o) => sql`(${o.id}::int, ${eventOfObs.get(o.id)!}::text)`), sql`, `);
    await db.execute(sql`update observations o set event_id = v.eid from (values ${values}) as v(id, eid) where o.id = v.id and o.event_id is distinct from v.eid`);
  }
  summary.observationsAttached = attach.length;

  // 5) Automatic events that lost all their CVEs to another event are hidden. An early event that
  // is absorbed by a KEV event gets a closing history row that names the event it merged into, so
  // the early call stays on record.
  const ownerOfCve = new Map<string, string>();
  for (const e of computed) for (const c of e.cveIds) ownerOfCve.set(c, e.id);
  for (const [id, movedCves] of emptied) {
    const left = await db.select({ n: sql<number>`count(*)::int` }).from(eventCves).where(eq(eventCves.eventId, id));
    if (left[0].n === 0 && isAuto(id)) {
      const [cur] = await db.select().from(events).where(eq(events.id, id));
      if (!cur || cur.hidden) continue;
      await db.update(events).set({ hidden: true, updatedAt: now }).where(and(eq(events.id, id), autoLike(events.id)));
      summary.eventsHidden++;
      if (id.startsWith(EARLY_PREFIX)) {
        const target = movedCves.map((c) => ownerOfCve.get(c)).find(Boolean);
        await db.insert(verdictHistory).values({
          eventId: id,
          verdict: cur.verdict,
          ladder: cur.ladder as Record<string, string>,
          rulesVersion: cur.rulesVersion,
          reason: target ? `Merged into ${target} after a KEV listing. This event is hidden; its history stays here.` : "Merged into another event after a KEV listing. This event is hidden; its history stays here.",
          actor: "rules",
        });
        summary.verdictChanges++;
      }
    }
  }
  return summary;
}

/**
 * Rewrites technical titles on visible events the rebuild no longer touches (older than the
 * lookback), so every listed event reads in plain language. Admin renames are never changed.
 * Returns how many titles changed. At most `limit` events per run.
 */
export async function refreshOldTitles(db: Db, limit = 200): Promise<number> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.hidden, false), sql`${events.titleOverride} is null`, sql`(${events.title} ~* 'vulnerability\\s*$' or ${events.title} ~ '^CVE-')`))
    .limit(limit);
  let changed = 0;
  for (const e of rows) {
    const cves = (await db.select().from(eventCves).where(eq(eventCves.eventId, e.id))).map((r) => r.cveId);
    if (!cves.length) continue;
    const vulns = await db.select().from(vulnerabilities).where(inArray(vulnerabilities.cveId, cves));
    const title = plainTitle({
      vendor: e.vendor ?? vulns[0]?.vendor,
      product: e.product ?? vulns[0]?.product,
      texts: [...vulns.flatMap((v) => [v.title, v.description]), e.title],
      cwe: vulns.flatMap((v) => v.cwe ?? []),
      count: cves.length,
      confirmed: !e.id.startsWith(EARLY_PREFIX),
      fallbackName: cves.length === 1 ? cves[0] : undefined,
    });
    if (title && title !== e.title) {
      await db.update(events).set({ title }).where(eq(events.id, e.id));
      changed++;
    }
  }
  return changed;
}
