import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { observations, sourceRuns, sources, vulnerabilities } from "@/lib/db/schema";
import type { AdapterResult, SourceAdapter } from "@/lib/ladder/types";
import type { Db } from "./db";
import { mergeVulnerabilityInputs, runDueSources, seedSources, upsertVulnerabilities } from "./runner";
import { SOURCE_REGISTRY } from "./registry";
import { archiveKey, createR2Archive, signPut } from "./r2";
import { createTestDb } from "./testdb";
import { fakeFetch, noSleep } from "./testing";

const t0 = new Date("2026-10-24T12:00:00Z");
const mk = (id: string, run: SourceAdapter["run"], intervalMinutes = 60): SourceAdapter => ({ id, name: id, intervalMinutes, run });
const obs = (key: string, cve = "CVE-2026-1001") => ({ sourceId: "cisa-kev", dedupeKey: key, kind: "exploited" as const, strength: "confirmed" as const, cveIds: [cve], title: key, url: "https://example.com" });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await seedSources(db);
});

const opts = (adapters: SourceAdapter[], extra = {}) => ({ adapters, now: t0, fetch: fakeFetch([]).fetch, sleep: noSleep, archive: null, env: {}, ...extra });

describe("seedSources", () => {
  it("seeds every registry source and keeps cursor and enabled on re-seed", async () => {
    expect((await db.select().from(sources)).length).toBe(SOURCE_REGISTRY.length);
    await db.update(sources).set({ cursor: "abc", enabled: false, intervalMinutes: 5 }).where(eq(sources.id, "epss"));
    await seedSources(db);
    const [row] = await db.select().from(sources).where(eq(sources.id, "epss"));
    expect(row).toMatchObject({ cursor: "abc", enabled: false, intervalMinutes: 5, termsStatus: "attribution" });
  });
});

describe("runDueSources", () => {
  it("writes observations, vulnerabilities, run and source bookkeeping", async () => {
    const a = mk("cisa-kev", async () => ({
      observations: [obs("k1"), obs("k2", "CVE-2026-1002")],
      vulnerabilities: [{ cveId: "CVE-2026-1001", vendor: "Plex", kevCisaDateAdded: "2026-10-20" }],
      raw: { body: "{}", contentType: "application/json" },
      cursor: "v1",
    }));
    const [s] = await runDueSources(db, opts([a]));
    expect(s).toMatchObject({ status: "ok", observationsFetched: 2, observationsNew: 2, vulnerabilities: 1 });
    const [src] = await db.select().from(sources).where(eq(sources.id, "cisa-kev"));
    expect(src.cursor).toBe("v1");
    expect(src.lastSuccessAt).toEqual(t0);
    expect(src.lastError).toBeNull();
    const [run] = await db.select().from(sourceRuns);
    expect(run).toMatchObject({ status: "ok", itemsNew: 2, payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const obsRows = await db.select().from(observations);
    expect(obsRows.every((o) => o.runId === run.id)).toBe(true);
  });

  it("is idempotent: re-running creates no duplicates", async () => {
    const a = mk("cisa-kev", async () => ({ observations: [obs("k1")], vulnerabilities: [] }));
    await runDueSources(db, opts([a]));
    const [again] = await runDueSources(db, opts([a], { force: true }));
    expect(again.observationsNew).toBe(0);
    expect(await db.select().from(observations)).toHaveLength(1);
  });

  it("dedupes within one batch", async () => {
    const a = mk("cisa-kev", async () => ({ observations: [obs("k1"), obs("k1")], vulnerabilities: [] }));
    const [s] = await runDueSources(db, opts([a]));
    expect(s.observationsNew).toBe(1);
  });

  it("records adapter failures and never throws", async () => {
    const a = mk("cisa-kev", async () => {
      throw new Error("upstream down");
    });
    const [s] = await runDueSources(db, opts([a]));
    expect(s).toMatchObject({ status: "error", error: "upstream down" });
    const [src] = await db.select().from(sources).where(eq(sources.id, "cisa-kev"));
    expect(src.lastError).toBe("upstream down");
    expect(src.lastSuccessAt).toBeNull();
    const [run] = await db.select().from(sourceRuns);
    expect(run).toMatchObject({ status: "error", error: "upstream down" });
  });

  it("keeps the last good cursor and success time after a failure", async () => {
    await runDueSources(db, opts([mk("cisa-kev", async () => ({ observations: [], vulnerabilities: [], cursor: "good" }))]));
    const later = new Date(t0.getTime() + 2 * 3600000);
    await runDueSources(db, opts([mk("cisa-kev", async () => Promise.reject(new Error("boom")))], { now: later }));
    const [src] = await db.select().from(sources).where(eq(sources.id, "cisa-kev"));
    expect(src).toMatchObject({ cursor: "good", lastError: "boom" });
    expect(src.lastSuccessAt).toEqual(t0);
  });

  it("only runs due sources and respects disabled", async () => {
    const calls: string[] = [];
    const a = mk("cisa-kev", async () => (calls.push("kev"), { observations: [], vulnerabilities: [] }), 60);
    const b = mk("epss", async () => (calls.push("epss"), { observations: [], vulnerabilities: [] }), 1440);
    await db.update(sources).set({ enabled: false }).where(eq(sources.id, "nvd"));
    const c = mk("nvd", async () => (calls.push("nvd"), { observations: [], vulnerabilities: [] }));
    await runDueSources(db, opts([a, b, c]));
    expect(calls).toEqual(["kev", "epss"]);
    calls.length = 0;
    const res = await runDueSources(db, opts([a, b, c], { now: new Date(t0.getTime() + 61 * 60000) }));
    expect(calls).toEqual(["kev"]);
    expect(res.map((r) => r.status)).toEqual(["ok", "not_due", "disabled"]);
  });

  it("treats a skipped adapter as neither success nor error and leaves no run row", async () => {
    const a = mk("vulncheck-kev", async (): Promise<AdapterResult> => ({ observations: [], vulnerabilities: [], skipped: "no token" }));
    const [s] = await runDueSources(db, opts([a]));
    expect(s).toMatchObject({ status: "skipped", note: "no token" });
    expect(await db.select().from(sourceRuns)).toHaveLength(0);
    const [src] = await db.select().from(sources).where(eq(sources.id, "vulncheck-kev"));
    expect(src.lastError).toBeNull();
    expect(src.lastRunAt).toBeNull();
  });

  it("reports sources with no row", async () => {
    const [s] = await runDueSources(db, opts([mk("mystery", async () => ({ observations: [], vulnerabilities: [] }))]));
    expect(s.status).toBe("no_source_row");
  });

  it("passes tracked CVEs (newest KEV first) and enrichment candidates to later sources", async () => {
    await upsertVulnerabilities(db, [
      { cveId: "CVE-2026-1001", kevCisaDateAdded: "2026-10-01" },
      { cveId: "CVE-2026-1002", kevCisaDateAdded: "2026-10-10", cvssScore: 9 },
      { cveId: "CVE-2026-1003" },
    ]);
    let seen: { tracked?: string[]; enrich?: string[] } = {};
    const nvd = mk("nvd", async (ctx) => ((seen = { tracked: ctx.trackedCves, enrich: ctx.enrichCves }), { observations: [], vulnerabilities: [] }));
    await runDueSources(db, opts([nvd]));
    expect(seen.tracked).toEqual(["CVE-2026-1002", "CVE-2026-1001"]);
    expect(seen.enrich).toEqual(["CVE-2026-1001"]);
  });

  it("refreshes tracked CVEs after a source adds vulnerabilities", async () => {
    const kev = mk("cisa-kev", async () => ({ observations: [], vulnerabilities: [{ cveId: "CVE-2026-2001", kevCisaDateAdded: "2026-10-23" }] }));
    let tracked: string[] | undefined;
    const epss = mk("epss", async (ctx) => ((tracked = ctx.trackedCves), { observations: [], vulnerabilities: [] }), 1440);
    await runDueSources(db, opts([kev, epss]));
    expect(tracked).toEqual(["CVE-2026-2001"]);
  });

  it("honors only and the time budget", async () => {
    let n = 0;
    const mkc = (id: string) => mk(id, async () => (n++, { observations: [], vulnerabilities: [] }));
    await runDueSources(db, opts([mkc("cisa-kev"), mkc("epss")], { only: ["epss"] }));
    expect(n).toBe(1);
    const r = await runDueSources(db, opts([mkc("cisa-kev"), mkc("nvd")], { budgetMs: -1, force: true }));
    expect(r.every((x) => x.status === "not_due")).toBe(true);
  });

  it("archives raw payloads once per distinct hash when R2 is configured", async () => {
    const puts: string[] = [];
    const archive = { put: async (k: string) => void puts.push(k) };
    const a = mk("cisa-kev", async () => ({ observations: [], vulnerabilities: [], raw: { body: "payload", contentType: "application/json" } }));
    const [first] = await runDueSources(db, opts([a], { archive }));
    expect(first.archived).toMatch(/^raw\/cisa-kev\/2026\/10\/24\//);
    await runDueSources(db, opts([a], { archive, force: true }));
    expect(puts).toHaveLength(1);
  });

  it("an archive failure does not fail the run", async () => {
    const archive = { put: async () => Promise.reject(new Error("r2 down")) };
    const a = mk("cisa-kev", async () => ({ observations: [], vulnerabilities: [], raw: { body: "x", contentType: "text/csv" } }));
    const [s] = await runDueSources(db, opts([a], { archive }));
    expect(s.status).toBe("ok");
    expect(s.note).toMatch(/r2 down/);
    const [run] = await db.select().from(sourceRuns);
    expect(run.rawObjectKey).toBeNull();
    expect(run.payloadSha256).toBeTruthy();
  });
});

describe("vulnerability merge", () => {
  it("merges non-null fields across runs and never downgrades", async () => {
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-1", vendor: "Plex", title: "KEV title", kevCisaDateAdded: "2026-10-20", exploitMaturity: "weaponized" }]);
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-1", vendor: "plex_inc", title: "Other", cvssScore: 9.8, epss: 0.4, exploitMaturity: "poc" }]);
    await upsertVulnerabilities(db, [{ cveId: "CVE-2026-1", kevCisaRansomware: true, epss: 0.5 }]);
    const [v] = await db.select().from(vulnerabilities).where(eq(vulnerabilities.cveId, "CVE-2026-1"));
    expect(v).toMatchObject({ vendor: "Plex", title: "KEV title", cvssScore: 9.8, epss: 0.5, kevCisaDateAdded: "2026-10-20", kevCisaRansomware: true, exploitMaturity: "weaponized" });
  });

  it("merges duplicates inside one batch", () => {
    const m = mergeVulnerabilityInputs([
      { cveId: "cve-2026-1", vendor: "A", exploitMaturity: "poc" },
      { cveId: "CVE-2026-1", vendor: "B", cvssScore: 5, exploitMaturity: "weaponized" },
      { cveId: "CVE-2026-1", exploitMaturity: "poc" },
    ]);
    expect(m).toEqual([{ cveId: "CVE-2026-1", vendor: "A", cvssScore: 5, exploitMaturity: "weaponized" }]);
  });
});

describe("r2", () => {
  it("is null without all env vars", () => {
    expect(createR2Archive({})).toBeNull();
    expect(createR2Archive({ R2_ACCOUNT_ID: "a", R2_BUCKET: "b" })).toBeNull();
  });

  it("PUTs a signed request", async () => {
    const f = fakeFetch([["r2.cloudflarestorage.com", "ok"]]);
    const a = createR2Archive({ R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "AK", R2_SECRET_ACCESS_KEY: "SK", R2_BUCKET: "stp" }, f.fetch, () => t0)!;
    await a.put("raw/x.json", "{}", "application/json");
    expect(f.calls[0].url).toBe("https://acct.r2.cloudflarestorage.com/stp/raw/x.json");
    expect(f.calls[0].headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/20261024\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  });

  it("signs deterministically", () => {
    const args = { host: "h", path: "/b/k", body: "x", contentType: "text/plain", accessKeyId: "AK", secretAccessKey: "SK", region: "auto", service: "s3", now: t0 };
    expect(signPut(args)).toEqual(signPut(args));
    expect(signPut(args).Authorization).not.toEqual(signPut({ ...args, body: "y" }).Authorization);
  });

  it("builds date partitioned keys", () => {
    expect(archiveKey("hibp", "abcdef0123456789", "application/json", t0)).toBe("raw/hibp/2026/10/24/2026-10-24T12-00-00-000Z-abcdef012345.json");
  });
});
