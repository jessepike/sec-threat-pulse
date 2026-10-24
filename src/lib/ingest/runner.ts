import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { observations, sourceRuns, sources, vulnerabilities } from "@/lib/db/schema";
import type { AdapterResult, ExploitMaturity, SourceAdapter, VulnerabilityInput } from "@/lib/ladder/types";
import type { Db } from "./db";
import { sha256Hex } from "./http";
import { archiveKey, createR2Archive, type RawArchive } from "./r2";
import { SOURCE_REGISTRY, type SourceDefinition } from "./registry";

const CHUNK = 200;
const MAX_TRACKED = 2000;

export interface RunnerOptions {
  adapters?: SourceAdapter[];
  now?: Date;
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  /** Run only these source ids. */
  only?: string[];
  /** Ignore the interval and run now (still skips disabled sources unless `only` names them). */
  force?: boolean;
  /** Stop starting new sources after this many ms. */
  budgetMs?: number;
  /** R2 archive. Defaults to one built from env (null when unset). */
  archive?: RawArchive | null;
}

export type RunStatus = "ok" | "error" | "skipped" | "not_due" | "disabled" | "no_source_row";

export interface SourceRunSummary {
  sourceId: string;
  status: RunStatus;
  observationsFetched: number;
  observationsNew: number;
  vulnerabilities: number;
  durationMs: number;
  runId?: number;
  archived?: string;
  error?: string;
  note?: string;
}

const chunks = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

const MATURITY_RANK: Record<string, number> = { none: 0, poc: 1, weaponized: 2 };

/** Merge duplicate CVE rows from one run. Earlier title, description, vendor and product win; other fields take the latest value. */
export function mergeVulnerabilityInputs(list: VulnerabilityInput[]): VulnerabilityInput[] {
  const out = new Map<string, VulnerabilityInput>();
  for (const v of list) {
    const key = v.cveId.toUpperCase();
    const cur = out.get(key);
    if (!cur) {
      out.set(key, { ...v, cveId: key });
      continue;
    }
    const keepFirst = new Set(["title", "description", "vendor", "product"]);
    for (const [k, val] of Object.entries(v) as [keyof VulnerabilityInput, unknown][]) {
      if (val === undefined || val === null) continue;
      if (k === "exploitMaturity") {
        if ((MATURITY_RANK[val as string] ?? 0) > (MATURITY_RANK[cur.exploitMaturity ?? "none"] ?? 0)) cur.exploitMaturity = val as ExploitMaturity;
      } else if (keepFirst.has(k) && cur[k] !== undefined) continue;
      else (cur as unknown as Record<string, unknown>)[k] = val;
    }
  }
  return [...out.values()];
}

const rank = (col: string) => sql.raw(`case ${col} when 'weaponized' then 2 when 'poc' then 1 else 0 end`);

/** Upsert vulnerabilities, merging non-null fields. */
export async function upsertVulnerabilities(db: Db, list: VulnerabilityInput[]): Promise<number> {
  const merged = mergeVulnerabilityInputs(list);
  for (const part of chunks(merged, CHUNK)) {
    await db
      .insert(vulnerabilities)
      .values(
        part.map((v) => ({
          cveId: v.cveId,
          title: v.title,
          description: v.description,
          vendor: v.vendor,
          product: v.product,
          cvssScore: v.cvssScore,
          cwe: v.cwe,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : undefined,
          epss: v.epss,
          epssPercentile: v.epssPercentile,
          epssDate: v.epssDate,
          kevCisaDateAdded: v.kevCisaDateAdded,
          kevCisaRansomware: v.kevCisaRansomware,
          kevVulncheckDateAdded: v.kevVulncheckDateAdded,
          exploitMaturity: v.exploitMaturity ?? "none",
        })),
      )
      .onConflictDoUpdate({
        target: vulnerabilities.cveId,
        set: {
          title: sql`coalesce(${vulnerabilities.title}, excluded.title)`,
          description: sql`coalesce(${vulnerabilities.description}, excluded.description)`,
          vendor: sql`coalesce(${vulnerabilities.vendor}, excluded.vendor)`,
          product: sql`coalesce(${vulnerabilities.product}, excluded.product)`,
          cvssScore: sql`coalesce(excluded.cvss_score, ${vulnerabilities.cvssScore})`,
          cwe: sql`coalesce(excluded.cwe, ${vulnerabilities.cwe})`,
          publishedAt: sql`coalesce(excluded.published_at, ${vulnerabilities.publishedAt})`,
          epss: sql`coalesce(excluded.epss, ${vulnerabilities.epss})`,
          epssPercentile: sql`coalesce(excluded.epss_percentile, ${vulnerabilities.epssPercentile})`,
          epssDate: sql`coalesce(excluded.epss_date, ${vulnerabilities.epssDate})`,
          kevCisaDateAdded: sql`coalesce(${vulnerabilities.kevCisaDateAdded}, excluded.kev_cisa_date_added)`,
          kevCisaRansomware: sql`coalesce(excluded.kev_cisa_ransomware, ${vulnerabilities.kevCisaRansomware})`,
          kevVulncheckDateAdded: sql`coalesce(${vulnerabilities.kevVulncheckDateAdded}, excluded.kev_vulncheck_date_added)`,
          exploitMaturity: sql`case when ${rank("excluded.exploit_maturity")} > ${rank('"vulnerabilities"."exploit_maturity"')} then excluded.exploit_maturity else "vulnerabilities"."exploit_maturity" end`,
          updatedAt: sql`now()`,
        },
      });
  }
  return merged.length;
}

/** Insert observations; existing dedupe keys are skipped. Returns how many rows were new. */
export async function insertObservations(db: Db, runId: number | undefined, list: AdapterResult["observations"]): Promise<number> {
  const byKey = new Map(list.map((o) => [o.dedupeKey, o]));
  let inserted = 0;
  for (const part of chunks([...byKey.values()], CHUNK)) {
    const rows = await db
      .insert(observations)
      .values(
        part.map((o) => {
          const published = o.publishedAt ? new Date(o.publishedAt) : null;
          return {
            sourceId: o.sourceId,
            runId,
            dedupeKey: o.dedupeKey,
            kind: o.kind,
            strength: o.strength,
            cveIds: o.cveIds.map((c) => c.toUpperCase()),
            vendor: o.vendor,
            product: o.product,
            orgName: o.orgName,
            title: o.title,
            summary: o.summary,
            url: o.url,
            publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
            metadata: o.metadata,
          };
        }),
      )
      .onConflictDoNothing({ target: observations.dedupeKey })
      .returning({ id: observations.id });
    inserted += rows.length;
  }
  return inserted;
}

/** Insert or refresh the `sources` rows from the registry. Keeps cursor, enabled and interval overrides. */
export async function seedSources(db: Db, defs: SourceDefinition[] = SOURCE_REGISTRY): Promise<number> {
  for (const d of defs) {
    await db
      .insert(sources)
      .values({
        id: d.adapter.id,
        name: d.adapter.name,
        category: d.category,
        homepage: d.homepage,
        termsStatus: d.termsStatus,
        attribution: d.attribution,
        intervalMinutes: d.adapter.intervalMinutes,
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: { name: d.adapter.name, category: d.category, homepage: d.homepage, termsStatus: d.termsStatus, attribution: d.attribution },
      });
  }
  return defs.length;
}

const kevDateExpr = sql`greatest(coalesce(${vulnerabilities.kevCisaDateAdded}, ''), coalesce(${vulnerabilities.kevVulncheckDateAdded}, ''))`;

/** CVEs in either KEV, newest first. */
export async function loadTrackedCves(db: Db, limit = MAX_TRACKED): Promise<string[]> {
  const rows = await db
    .select({ cveId: vulnerabilities.cveId })
    .from(vulnerabilities)
    .where(or(isNotNull(vulnerabilities.kevCisaDateAdded), isNotNull(vulnerabilities.kevVulncheckDateAdded)))
    .orderBy(desc(kevDateExpr), desc(vulnerabilities.cveId))
    .limit(limit);
  return rows.map((r) => r.cveId);
}

/** Tracked CVEs that still have no CVSS score. */
export async function loadEnrichCves(db: Db, limit = 100): Promise<string[]> {
  const rows = await db
    .select({ cveId: vulnerabilities.cveId })
    .from(vulnerabilities)
    .where(and(or(isNotNull(vulnerabilities.kevCisaDateAdded), isNotNull(vulnerabilities.kevVulncheckDateAdded)), isNull(vulnerabilities.cvssScore)))
    .orderBy(desc(kevDateExpr), desc(vulnerabilities.cveId))
    .limit(limit);
  return rows.map((r) => r.cveId);
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/**
 * Run every enabled source whose interval has elapsed, in registry order.
 * Never throws for an adapter failure: the error is recorded on the run and the source.
 */
export async function runDueSources(db: Db, opts: RunnerOptions = {}): Promise<SourceRunSummary[]> {
  const adapters = opts.adapters ?? SOURCE_REGISTRY.map((d) => d.adapter);
  const now = opts.now ?? new Date();
  const started = Date.now();
  const env = opts.env ?? process.env;
  const archive = opts.archive === undefined ? createR2Archive(env) : opts.archive;
  const rows = new Map((await db.select().from(sources)).map((r) => [r.id, r]));
  const summaries: SourceRunSummary[] = [];
  let tracked: string[] | undefined;
  let enrich: string[] | undefined;

  for (const adapter of adapters) {
    if (opts.only && !opts.only.includes(adapter.id)) continue;
    const row = rows.get(adapter.id);
    const base = { sourceId: adapter.id, observationsFetched: 0, observationsNew: 0, vulnerabilities: 0, durationMs: 0 };
    if (!row) {
      summaries.push({ ...base, status: "no_source_row", note: "Run seed-sources first" });
      continue;
    }
    if (!row.enabled && !opts.only) {
      summaries.push({ ...base, status: "disabled" });
      continue;
    }
    const intervalMs = (row.intervalMinutes ?? adapter.intervalMinutes) * 60000;
    // A minute of slack so a 15 minute cron does not skip a 15 minute source by seconds.
    if (!opts.force && row.lastRunAt && now.getTime() - row.lastRunAt.getTime() < intervalMs - 60000) {
      summaries.push({ ...base, status: "not_due" });
      continue;
    }
    if (opts.budgetMs && Date.now() - started > opts.budgetMs) {
      summaries.push({ ...base, status: "not_due", note: "Time budget used up; will run next tick" });
      continue;
    }

    const t0 = Date.now();
    const summary = await runOne(db, adapter, row.cursor ?? undefined, {
      now,
      env,
      archive,
      fetchFn: opts.fetch ?? fetch,
      sleep: opts.sleep,
      loadTracked: async () => (tracked ??= await loadTrackedCves(db)),
      loadEnrich: async () => (enrich ??= await loadEnrichCves(db)),
    });
    summary.durationMs = Date.now() - t0;
    // New vulnerability facts change what later sources should look up.
    if (summary.vulnerabilities > 0) {
      tracked = undefined;
      enrich = undefined;
    }
    summaries.push(summary);
  }
  return summaries;
}

interface RunDeps {
  now: Date;
  env: Record<string, string | undefined>;
  archive: RawArchive | null;
  fetchFn: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  loadTracked: () => Promise<string[]>;
  loadEnrich: () => Promise<string[]>;
}

async function runOne(db: Db, adapter: SourceAdapter, cursor: string | undefined, deps: RunDeps): Promise<SourceRunSummary> {
  const summary: SourceRunSummary = { sourceId: adapter.id, status: "ok", observationsFetched: 0, observationsNew: 0, vulnerabilities: 0, durationMs: 0 };
  let runId: number | undefined;
  try {
    const [run] = await db.insert(sourceRuns).values({ sourceId: adapter.id, startedAt: deps.now }).returning({ id: sourceRuns.id });
    runId = run.id;
    summary.runId = runId;

    const result = await adapter.run({
      cursor,
      fetch: deps.fetchFn,
      now: deps.now,
      env: deps.env,
      sleep: deps.sleep,
      trackedCves: await deps.loadTracked(),
      enrichCves: adapter.id === "nvd" ? await deps.loadEnrich() : undefined,
    });

    if (result.skipped) {
      await db.delete(sourceRuns).where(eq(sourceRuns.id, runId));
      return { ...summary, status: "skipped", runId: undefined, note: result.skipped };
    }

    summary.observationsFetched = result.observations.length;
    summary.vulnerabilities = result.vulnerabilities.length;
    if (result.vulnerabilities.length) await upsertVulnerabilities(db, result.vulnerabilities);
    summary.observationsNew = result.observations.length ? await insertObservations(db, runId, result.observations) : 0;

    let sha: string | undefined;
    let objectKey: string | undefined;
    if (result.raw) {
      sha = sha256Hex(result.raw.body);
      if (deps.archive) {
        try {
          const [prev] = await db
            .select({ id: sourceRuns.id })
            .from(sourceRuns)
            .where(and(eq(sourceRuns.sourceId, adapter.id), eq(sourceRuns.payloadSha256, sha), isNotNull(sourceRuns.rawObjectKey)))
            .limit(1);
          if (!prev) {
            objectKey = archiveKey(adapter.id, sha, result.raw.contentType, deps.now);
            await deps.archive.put(objectKey, result.raw.body, result.raw.contentType);
            summary.archived = objectKey;
          }
        } catch (e) {
          objectKey = undefined;
          summary.note = `Archive failed: ${errMsg(e)}`;
        }
      }
    }

    await db
      .update(sourceRuns)
      .set({
        status: "ok",
        finishedAt: new Date(),
        itemsFetched: summary.observationsFetched + summary.vulnerabilities,
        itemsNew: summary.observationsNew,
        payloadSha256: sha,
        rawObjectKey: objectKey,
      })
      .where(eq(sourceRuns.id, runId));
    await db
      .update(sources)
      .set({
        lastRunAt: deps.now,
        lastSuccessAt: deps.now,
        lastError: null,
        ...(result.cursor !== undefined ? { cursor: result.cursor } : {}),
      })
      .where(eq(sources.id, adapter.id));
    return summary;
  } catch (e) {
    const message = errMsg(e);
    try {
      if (runId !== undefined) {
        await db.update(sourceRuns).set({ status: "error", finishedAt: new Date(), error: message }).where(eq(sourceRuns.id, runId));
      }
      await db.update(sources).set({ lastRunAt: deps.now, lastError: message }).where(eq(sources.id, adapter.id));
    } catch {
      // Bookkeeping must never throw past the runner.
    }
    return { ...summary, status: "error", error: message };
  }
}
