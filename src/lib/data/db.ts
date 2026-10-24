import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { RUNGS, type ExploitMaturity, type Ladder, type RungState, type Verdict } from "@/lib/ladder/types";
import { RUNG_SHORT, topConfirmed } from "./sample";
import { firstQuestion, questionLines } from "@/lib/narrative/model";
import type { ClaimView, CountsView, EventRow, EventView, RungView, SourceRef, StatusView, TimelineItem } from "./types";

type Db = NonNullable<ReturnType<typeof getDb>>;

const VERDICT_RANK: Record<Verdict, number> = { act_now: 0, watch: 1, low: 2 };

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

function ladderScore(l: Ladder): number {
  return RUNGS.reduce((n, r, i) => n + (l[r] === "confirmed" ? 2 : l[r] === "reported" ? 1 : 0) * (i + 1), 0);
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

function toRow(e: EventRecord, cves: string[], n?: Pick<NarrativeRecord, "askYourTeam">): EventRow {
  const ladder = asLadder(e.ladder);
  const verdict = asVerdict(e.overrideVerdict ?? e.verdict);
  return {
    id: e.id,
    href: `/events/${e.id}`,
    title: e.title,
    idsLabel: idsLabel(cves),
    exposure: e.summary ?? "No summary written yet.",
    question: firstQuestion(n?.askYourTeam),
    verdict,
    ladder,
    topConfirmed: topConfirmed(ladder),
  };
}

export async function dbListEvents(): Promise<EventRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(schema.events).where(eq(schema.events.hidden, false)).orderBy(desc(schema.events.updatedAt)).limit(60);
  const cves = await cvesByEvent(db, rows.map((r) => r.id));
  const narratives = await publishedNarratives(db, rows.map((r) => r.id));
  return rows
    .map((e) => ({ e, row: toRow(e, cves.get(e.id) ?? [], narratives.get(e.id)) }))
    .sort((a, b) => VERDICT_RANK[a.row.verdict] - VERDICT_RANK[b.row.verdict] || ladderScore(b.row.ladder) - ladderScore(a.row.ladder) || b.e.updatedAt.getTime() - a.e.updatedAt.getTime())
    .map((x) => x.row);
}

export async function dbEventSummaries(): Promise<{ row: EventRow; summary: string; updatedAt: string; cvss?: number }[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(schema.events).where(eq(schema.events.hidden, false)).orderBy(desc(schema.events.updatedAt)).limit(60);
  const cves = await cvesByEvent(db, rows.map((r) => r.id));
  const narratives = await publishedNarratives(db, rows.map((r) => r.id));
  const all = [...cves.values()].flat();
  const vulns = all.length ? await db.select({ cveId: schema.vulnerabilities.cveId, cvss: schema.vulnerabilities.cvssScore }).from(schema.vulnerabilities).where(inArray(schema.vulnerabilities.cveId, all)) : [];
  const cvssOf = new Map(vulns.map((v) => [v.cveId, v.cvss]));
  return rows
    .map((e) => {
      const list = cves.get(e.id) ?? [];
      const scores = list.map((c) => cvssOf.get(c)).filter((x): x is number => typeof x === "number");
      return { e, row: toRow(e, list, narratives.get(e.id)), summary: e.summary ?? "", updatedAt: e.updatedAt.toISOString(), cvss: scores.length ? Math.max(...scores) : undefined };
    })
    .sort((a, b) => VERDICT_RANK[a.row.verdict] - VERDICT_RANK[b.row.verdict] || ladderScore(b.row.ladder) - ladderScore(a.row.ladder) || b.e.updatedAt.getTime() - a.e.updatedAt.getTime())
    .map(({ row, summary, updatedAt, cvss }) => ({ row, summary, updatedAt, cvss }));
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
    const text = mine.length
      ? mine.slice(0, 2).map((x) => x.o.summary || x.o.title).join(" ")
      : ladder[r] === "none"
        ? "No evidence yet."
        : "Evidence is recorded but no summary is available.";
    return { rung: r, num: String(i + 1).padStart(2, "0"), step: RUNG_SHORT[r], state: ladder[r], evidence: text, sources: mine.slice(0, 4).map(ref) };
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
    .map((x) => ({ when: new Date(x.o.publishedAt!).toISOString().slice(0, 10), what: x.o.title, hot: x.o.kind === "attempts" || x.o.kind === "exploited" || x.o.kind === "damage" }));

  const scores = vulns.map((v) => v.cvssScore).filter((n): n is number => typeof n === "number");
  const kev = vulns.some((v) => v.kevCisaDateAdded);
  const top = topConfirmed(ladder);
  const row = toRow(e, cves, narrative);
  const sourceMap = new Map<string, SourceRef>();
  for (const x of obs) if (!sourceMap.has(x.o.url)) sourceMap.set(x.o.url, ref(x));

  return {
    ...row,
    cves,
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
    businessTerms: narrative?.businessExposure?.trim() || undefined,
    whyAct: narrative?.whyAct?.trim() || undefined,
    fix: narrative?.fix?.trim() || undefined,
    askYourTeam: narrative ? questionLines(narrative.askYourTeam) : undefined,
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
