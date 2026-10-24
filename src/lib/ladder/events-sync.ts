import { and, eq, inArray, like, sql } from "drizzle-orm";
import { eventCves, events, observations, verdictHistory, vulnerabilities } from "@/lib/db/schema";
import type { Db } from "@/lib/ingest/db";
import { ladderEquals } from "./compute";
import { buildEvents, DEFAULT_LOOKBACK_DAYS, type ComputedEvent, type EventObservation, type EventVuln } from "./events";
import { CURRENT_RULES_VERSION } from "./rules";
import type { ObservationKind, ObservationStrength } from "./types";

export interface SyncOptions {
  now?: Date;
  lookbackDays?: number;
  rulesVersion?: string;
}

export interface SyncSummary {
  considered: number;
  created: number;
  updated: number;
  unchanged: number;
  verdictChanges: number;
  observationsAttached: number;
  eventsHidden: number;
}

const CHUNK = 300;
const chunks = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

const AUTO_PREFIX = "kev-";

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
  const summary: SyncSummary = { considered: 0, created: 0, updated: 0, unchanged: 0, verdictChanges: 0, observationsAttached: 0, eventsHidden: 0 };

  // Load a margin beyond the lookback so a cluster that straddles the cutoff keeps its full CVE set.
  const loadFrom = new Date(now.getTime() - (lookback + 30) * 86400000).toISOString().slice(0, 10);
  const vulnRows = await db
    .select()
    .from(vulnerabilities)
    .where(sql`${vulnerabilities.kevCisaDateAdded} >= ${loadFrom} or ${vulnerabilities.kevVulncheckDateAdded} >= ${loadFrom}`);
  if (!vulnRows.length) return summary;
  const vulns: EventVuln[] = vulnRows;

  const obsRows: (EventObservation & { eventId: string | null })[] = [];
  for (const part of chunks(vulnRows.map((v) => v.cveId), 400)) {
    const list = sql.join(part.map((c) => sql`${c}`), sql`, `);
    const rows = await db
      .select({
        id: observations.id,
        sourceId: observations.sourceId,
        kind: observations.kind,
        strength: observations.strength,
        cveIds: observations.cveIds,
        metadata: observations.metadata,
        eventId: observations.eventId,
      })
      .from(observations)
      .where(sql`${observations.cveIds} ?| array[${list}]::text[]`);
    for (const r of rows) obsRows.push({ ...r, kind: r.kind as ObservationKind, strength: r.strength as ObservationStrength });
  }
  const uniqueObs = [...new Map(obsRows.map((o) => [o.id, o])).values()];

  const computed = buildEvents(vulns, uniqueObs, { now, lookbackDays: lookback, rulesVersion });
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
      cur.exploitMaturity !== e.exploitMaturity ||
      cur.verdictReason !== e.verdictReason ||
      cur.rulesVersion !== e.rulesVersion;
    if (ladderChanged || verdictChanged || fieldsChanged) toUpdate.push({ e, ladderOrVerdictChanged: ladderChanged || verdictChanged });
    else summary.unchanged++;
  }

  const row = (e: ComputedEvent) => ({
    title: e.title,
    summary: e.summary,
    vendor: e.vendor,
    product: e.product,
    ladder: e.ladder as Record<string, string>,
    exploitMaturity: e.exploitMaturity,
    verdict: e.verdict,
    verdictReason: e.verdictReason,
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
  const emptied = new Set<string>();
  for (const x of extra) {
    await db.delete(eventCves).where(and(eq(eventCves.eventId, x.eventId), eq(eventCves.cveId, x.cveId)));
    emptied.add(x.eventId);
  }
  // Automatic events outside this rebuild that still hold CVEs now owned by a rebuilt event
  // (two clusters merged because a bridging CVE arrived). Release those CVEs.
  const allCves = [...new Set(computed.flatMap((e) => e.cveIds))];
  const idSet = new Set(ids);
  for (const part of chunks(allCves, CHUNK)) {
    const stale = await db
      .select()
      .from(eventCves)
      .where(and(inArray(eventCves.cveId, part), like(eventCves.eventId, `${AUTO_PREFIX}%`)));
    for (const x of stale) {
      if (idSet.has(x.eventId)) continue;
      await db.delete(eventCves).where(and(eq(eventCves.eventId, x.eventId), eq(eventCves.cveId, x.cveId)));
      emptied.add(x.eventId);
    }
  }

  // 4) Observation to event links. Admin assigned links (non automatic ids) are kept.
  const eventOfObs = new Map<number, string>();
  for (const e of computed) for (const id of e.observationIds) if (!eventOfObs.has(id)) eventOfObs.set(id, e.id);
  const attach = uniqueObs.filter((o) => {
    const target = eventOfObs.get(o.id);
    if (!target || o.eventId === target) return false;
    return o.eventId === null || o.eventId.startsWith(AUTO_PREFIX);
  });
  for (const part of chunks(attach, 500)) {
    const values = sql.join(part.map((o) => sql`(${o.id}::int, ${eventOfObs.get(o.id)!}::text)`), sql`, `);
    await db.execute(sql`update observations o set event_id = v.eid from (values ${values}) as v(id, eid) where o.id = v.id and o.event_id is distinct from v.eid`);
  }
  summary.observationsAttached = attach.length;

  // 5) Automatic events that lost all their CVEs to another event are hidden.
  for (const id of emptied) {
    const left = await db.select({ n: sql<number>`count(*)::int` }).from(eventCves).where(eq(eventCves.eventId, id));
    if (left[0].n === 0 && id.startsWith(AUTO_PREFIX)) {
      await db.update(events).set({ hidden: true, updatedAt: now }).where(and(eq(events.id, id), like(events.id, `${AUTO_PREFIX}%`)));
      summary.eventsHidden++;
    }
  }
  return summary;
}
