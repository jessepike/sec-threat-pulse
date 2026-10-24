// Builds the historical dataset for the verdict backtest from public sources.
//
// Usage: npx tsx scripts/backtest/build-dataset.ts [--from 2025-04-01] [--to 2026-10-01]
//        [--seed 42] [--signal-cap 3000] [--random 2000] [--out data/backtest/dataset.json.gz]
//
// Everything downloaded lands under .cache/backtest/ (gitignored). Git clones give point-in-time
// history for Vulnrichment (SSVC), Metasploit and nuclei. See docs/methodology-rules.md for the
// rebuild steps and the known limits of each source.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { parseCveRecord } from "../../src/lib/ingest/adapters/cvelist";
import { classifyCirclSource } from "../../src/lib/ingest/adapters/circl-sightings";
import { httpGet, STP_USER_AGENT } from "../../src/lib/ingest/http";
import { extractCves, parseCsvObjects } from "../../src/lib/ingest/util";
import type { BacktestCve, BacktestDataset, CirclSighting, Stratum } from "../../src/lib/backtest/types";
import { loadLocalEnv } from "../env";

loadLocalEnv();

const args = process.argv.slice(2);
const flag = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt;
};
const FROM = flag("from", "2025-04-01");
const TO = flag("to", "2026-10-01");
const SEED = Number(flag("seed", "42"));
const SIGNAL_CAP = Number(flag("signal-cap", "3000"));
const RANDOM_N = Number(flag("random", "2000"));
const OUT = flag("out", "data/backtest/dataset.json.gz");
const CVSS_MIN = 7;
const MAX_COMMITTED_BYTES = 20 * 1024 * 1024;

const CACHE = ".cache/backtest";
const REPOS = join(CACHE, "repos");
/** Shallow clones start at this day. A file first seen at or before it existed before the window. */
const HISTORY_HORIZON = "2025-03-05";
const today = new Date().toISOString().slice(0, 10);

const log = (...xs: unknown[]) => console.error(new Date().toISOString().slice(11, 19), ...xs);
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);
const clampHorizon = (d: string) => (d <= HISTORY_HORIZON ? HISTORY_HORIZON : d);
const ensureDir = (p: string) => mkdirSync(p, { recursive: true });

// ---------- download helpers ----------

async function cachedDownload(url: string, file: string, maxAgeHours = 24): Promise<string> {
  const path = join(CACHE, file);
  if (existsSync(path) && Date.now() - statSync(path).mtimeMs < maxAgeHours * 3600000) return readFileSync(path, "utf8");
  log("GET", url);
  const res = await httpGet(fetch, url, { timeoutMs: 120000 });
  ensureDir(join(path, ".."));
  writeFileSync(path, res.body);
  return res.body;
}

async function cachedDownloadBinary(url: string, path: string): Promise<Buffer | undefined> {
  if (existsSync(path) && statSync(path).size > 0) return readFileSync(path);
  const res = await fetch(url, { headers: { "User-Agent": STP_USER_AGENT }, redirect: "follow" });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  ensureDir(join(path, ".."));
  writeFileSync(path, buf);
  return buf;
}

function ensureClone(name: string, url: string, extra: string[]): string {
  const dir = join(REPOS, name);
  if (!existsSync(join(dir, ".git"))) {
    ensureDir(REPOS);
    log("git clone", url);
    execFileSync("git", ["clone", "-q", ...extra, url, dir], { stdio: "inherit" });
  }
  return dir;
}

function git(dir: string, argv: string[]): string {
  return execFileSync("git", ["-C", dir, ...argv], { encoding: "utf8", maxBuffer: 1 << 30 });
}

/** `git log --format=--%cI --name-only` output to earliest day per file. */
function parseAddedLog(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let date = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("--")) date = clampHorizon(line.slice(2, 12));
    else if (line.trim()) {
      const f = line.trim();
      const prev = out.get(f);
      if (!prev || date < prev) out.set(f, date);
    }
  }
  return out;
}

function cachedGitLog(dir: string, cacheFile: string, argv: string[]): Map<string, string> {
  const path = join(CACHE, cacheFile);
  if (!existsSync(path)) {
    log("git log", dir, argv.slice(0, 3).join(" "));
    writeFileSync(path, git(dir, ["log", ...argv]));
  }
  return parseAddedLog(readFileSync(path, "utf8"));
}

// ---------- sources ----------

interface KevRow {
  cveID: string;
  dateAdded: string;
  knownRansomwareCampaignUse?: string;
  vendorProject?: string;
  product?: string;
}

async function loadKev(): Promise<{ map: Map<string, KevRow>; version: string }> {
  const body = await cachedDownload("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", "kev.json");
  const cat = JSON.parse(body) as { catalogVersion?: string; vulnerabilities: KevRow[] };
  const map = new Map<string, KevRow>();
  for (const v of cat.vulnerabilities) map.set(v.cveID.toUpperCase(), v);
  return { map, version: cat.catalogVersion ?? "unknown" };
}

interface CveSummary {
  cveId: string;
  state?: string;
  published?: string;
  cvss?: number;
  vendor?: string;
  product?: string;
}

function summarize(cveId: string, record: Record<string, unknown>): CveSummary {
  const { vulnerability } = parseCveRecord(cveId, record);
  const meta = (record.cveMetadata ?? {}) as Record<string, unknown>;
  return {
    cveId,
    state: typeof meta.state === "string" ? meta.state : undefined,
    published: day(vulnerability.publishedAt),
    cvss: vulnerability.cvssScore,
    vendor: vulnerability.vendor,
    product: vulnerability.product,
  };
}

/** Every 2025 and 2026 CVE record from a sparse clone of cvelistV5, summarized and cached. */
function loadCveList(): Map<string, CveSummary> {
  const cachePath = join(CACHE, "cvelist-summary.json");
  if (existsSync(cachePath) && Date.now() - statSync(cachePath).mtimeMs < 24 * 3600000) {
    return new Map((JSON.parse(readFileSync(cachePath, "utf8")) as CveSummary[]).map((s) => [s.cveId, s]));
  }
  const dir = ensureClone("cvelist", "https://github.com/CVEProject/cvelistV5", ["--depth", "1", "--filter=blob:none", "--sparse"]);
  if (!existsSync(join(dir, "cves", "2026"))) {
    log("sparse checkout cves/2025 cves/2026 (this fetches about 1.5 GB)");
    git(dir, ["sparse-checkout", "set", "cves/2025", "cves/2026"]);
  }
  const out: CveSummary[] = [];
  for (const year of ["2025", "2026"]) {
    const ydir = join(dir, "cves", year);
    if (!existsSync(ydir)) continue;
    for (const bucket of readdirSync(ydir)) {
      const bdir = join(ydir, bucket);
      for (const f of readdirSync(bdir)) {
        if (!f.endsWith(".json")) continue;
        try {
          out.push(summarize(f.slice(0, -5).toUpperCase(), JSON.parse(readFileSync(join(bdir, f), "utf8"))));
        } catch {
          // skip unreadable record
        }
      }
    }
    log(`cvelist ${year}: ${out.length} records so far`);
  }
  writeFileSync(cachePath, JSON.stringify(out));
  return new Map(out.map((s) => [s.cveId, s]));
}

/** Older CVE records (KEV members from before 2025) fetched one at a time from the raw repo. */
async function fetchCveRecord(cveId: string): Promise<CveSummary | undefined> {
  const m = cveId.match(/^CVE-(\d{4})-(\d{4,})$/);
  if (!m) return undefined;
  const path = `${m[1]}/${Math.floor(Number(m[2]) / 1000)}xxx/${cveId}.json`;
  const buf = await cachedDownloadBinary(`https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/${path}`, join(CACHE, "cve", `${cveId}.json`));
  if (!buf) return undefined;
  try {
    return summarize(cveId, JSON.parse(buf.toString("utf8")));
  } catch {
    return undefined;
  }
}

async function loadMetasploit(): Promise<Map<string, string[]>> {
  const body = await cachedDownload("https://raw.githubusercontent.com/rapid7/metasploit-framework/master/db/modules_metadata_base.json", "metasploit-metadata.json");
  const dir = ensureClone("metasploit", "https://github.com/rapid7/metasploit-framework", ["--filter=blob:none", "--shallow-since=2025-03-01", "--no-checkout"]);
  const added = cachedGitLog(dir, "metasploit-added.log", ["--diff-filter=A", "--format=--%cI", "--name-only", "--", "modules/exploits"]);
  const modules = JSON.parse(body) as Record<string, { type?: string; fullname?: string; references?: string[]; path?: string }>;
  const out = new Map<string, string[]>();
  for (const m of Object.values(modules)) {
    if (m.type !== "exploit" || !m.fullname) continue;
    const cves = extractCves(m.references);
    if (!cves.length) continue;
    const gitPath = (m.path ?? `/modules/${m.fullname}.rb`).replace(/^\//, "");
    const d = added.get(gitPath) ?? HISTORY_HORIZON;
    for (const c of cves) (out.get(c) ?? out.set(c, []).get(c)!).push(d);
  }
  return out;
}

async function loadNuclei(): Promise<Map<string, string>> {
  const body = await cachedDownload("https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/main/cves.json", "nuclei-cves.json");
  const dir = ensureClone("nuclei", "https://github.com/projectdiscovery/nuclei-templates", ["--filter=blob:none", "--shallow-since=2025-03-01", "--no-checkout"]);
  const added = cachedGitLog(dir, "nuclei-added.log", ["--diff-filter=A", "--format=--%cI", "--name-only", "--", "."]);
  const byCve = new Map<string, string>();
  for (const [file, d] of added) {
    const m = file.match(/(CVE-\d{4}-\d{4,})\.yaml$/i);
    if (!m) continue;
    const c = m[1].toUpperCase();
    const prev = byCve.get(c);
    if (!prev || d < prev) byCve.set(c, d);
  }
  const out = new Map<string, string>();
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as { ID?: string };
      if (r.ID && /^CVE-\d{4}-\d{4,}$/i.test(r.ID)) {
        const c = r.ID.toUpperCase();
        out.set(c, byCve.get(c) ?? HISTORY_HORIZON);
      }
    } catch {
      // skip
    }
  }
  return out;
}

function loadVulnrichment(): { active: Map<string, string>; poc: Map<string, string> } {
  // Blobs are needed here: the pickaxe search reads file contents. About 330 MB.
  const dir = ensureClone("vulnrichment", "https://github.com/cisagov/vulnrichment", ["--shallow-since=2025-03-01", "--no-checkout"]);
  const byCve = (m: Map<string, string>) => {
    const out = new Map<string, string>();
    for (const [file, d] of m) {
      const x = file.match(/(CVE-\d{4}-\d{4,})\.json$/i);
      if (!x) continue;
      const c = x[1].toUpperCase();
      const prev = out.get(c);
      if (!prev || d < prev) out.set(c, d);
    }
    return out;
  };
  return {
    active: byCve(cachedGitLog(dir, "vulnrichment-active.log", ["-S", '"Exploitation": "active"', "--format=--%cI", "--name-only", "--", "."])),
    poc: byCve(cachedGitLog(dir, "vulnrichment-poc.log", ["-S", '"Exploitation": "poc"', "--format=--%cI", "--name-only", "--", "."])),
  };
}

function loadPocGithub(): Map<string, { created: string; stars: number }[]> {
  const dir = ensureClone("poc-in-github", "https://github.com/nomi-sec/PoC-in-GitHub", ["--depth", "1"]);
  const out = new Map<string, { created: string; stars: number }[]>();
  for (const year of readdirSync(dir)) {
    if (!/^\d{4}$/.test(year)) continue;
    for (const f of readdirSync(join(dir, year))) {
      if (!f.endsWith(".json")) continue;
      try {
        const repos = JSON.parse(readFileSync(join(dir, year, f), "utf8")) as { created_at?: string; stargazers_count?: number }[];
        const list = repos.filter((r) => r.created_at).map((r) => ({ created: r.created_at!.slice(0, 10), stars: r.stargazers_count ?? 0 }));
        if (list.length) out.set(f.slice(0, -5).toUpperCase(), list);
      } catch {
        // skip
      }
    }
  }
  return out;
}

async function loadExploitDb(): Promise<Map<string, string[]>> {
  const csv = await cachedDownload("https://gitlab.com/exploit-database/exploitdb/-/raw/main/files_exploits.csv", "exploitdb.csv");
  const out = new Map<string, string[]>();
  for (const r of parseCsvObjects(csv)) {
    const d = day(r.date_published) ?? day(r.date_added);
    if (!d) continue;
    for (const c of extractCves(r.codes)) (out.get(c) ?? out.set(c, []).get(c)!).push(d);
  }
  return out;
}

interface CirclRow {
  type: string;
  source?: string;
  vulnerability?: string;
  creation_timestamp?: string;
}

/** All CIRCL sightings of the exploitation and PoC types, paged at 1000 and cached per page. */
async function loadCircl(): Promise<Map<string, CirclSighting[]>> {
  const dir = join(CACHE, "circl");
  ensureDir(dir);
  const types: [string, CirclSighting["type"]][] = [["exploited", "exploited"], ["published-proof-of-concept", "poc"], ["confirmed", "confirmed"]];
  const out = new Map<string, CirclSighting[]>();
  let requests = 0;
  for (const [apiType, type] of types) {
    for (let page = 1; page < 2000; page++) {
      const path = join(dir, `${apiType}-${String(page).padStart(4, "0")}.json`);
      let body: string;
      if (existsSync(path) && statSync(path).size > 0) body = readFileSync(path, "utf8");
      else {
        // 20 requests a minute are allowed.
        if (requests++ > 0) await new Promise((r) => setTimeout(r, 3500));
        const res = await httpGet(fetch, `https://vulnerability.circl.lu/api/sighting/?type=${apiType}&per_page=1000&page=${page}`, { timeoutMs: 60000 });
        body = res.body;
        writeFileSync(path, body);
      }
      const data = (JSON.parse(body) as { data?: CirclRow[] }).data ?? [];
      for (const s of data) {
        const c = s.vulnerability?.toUpperCase();
        const d = day(s.creation_timestamp);
        if (!c || !d || !/^CVE-\d{4}-\d{4,}$/.test(c)) continue;
        const k = classifyCirclSource(s.source);
        (out.get(c) ?? out.set(c, []).get(c)!).push({ type, date: d, sourceKind: k.kind, sourceId: k.id });
      }
      if (data.length < 1000) break;
    }
    log(`circl ${apiType}: ${out.size} CVEs so far`);
  }
  return out;
}

/** VulnCheck KEV listing days, only when a token is set. */
async function loadVulncheck(): Promise<Map<string, string> | undefined> {
  const token = process.env.VULNCHECK_API_TOKEN;
  if (!token) return undefined;
  const path = join(CACHE, "vulncheck-kev.json");
  let entries: { cve?: string[]; date_added?: string }[] = [];
  if (existsSync(path)) entries = JSON.parse(readFileSync(path, "utf8"));
  else {
    let cursor: string | undefined;
    for (let page = 0; page < 200; page++) {
      const url = cursor
        ? `https://api.vulncheck.com/v3/index/vulncheck-kev?cursor=${encodeURIComponent(cursor)}&limit=500`
        : "https://api.vulncheck.com/v3/index/vulncheck-kev?start_cursor=true&limit=500";
      const res = await httpGet(fetch, url, { headers: { Authorization: `Bearer ${token}` } });
      const pageData = JSON.parse(res.body) as { _meta?: { next_cursor?: string | null }; data?: typeof entries };
      entries.push(...(pageData.data ?? []));
      cursor = pageData._meta?.next_cursor ?? undefined;
      if (!cursor || !pageData.data?.length) break;
    }
    writeFileSync(path, JSON.stringify(entries));
  }
  const out = new Map<string, string>();
  for (const e of entries) {
    const d = day(e.date_added);
    if (!d) continue;
    for (const c of e.cve ?? []) {
      const u = c.toUpperCase();
      if (!out.has(u) || d < out.get(u)!) out.set(u, d);
    }
  }
  return out;
}

/** Daily EPSS bulk files, filtered to the sampled CVEs and reduced to change points. */
async function loadEpss(cves: Set<string>, from: string, to: string): Promise<Map<string, [string, number][]>> {
  const dir = join(CACHE, "epss");
  ensureDir(dir);
  const series = new Map<string, [string, number][]>();
  const last = new Map<string, number>();
  // Map keys must not be slices of the big daily text, or every day's text stays in memory.
  const canonical = new Map([...cves].map((c) => [c, c]));
  // Start a little before the window so the first day has a score.
  const start = new Date(`${from}T00:00:00Z`).getTime() - 10 * 86400000;
  const endMs = new Date(`${to}T00:00:00Z`).getTime();
  let missing = 0;
  for (let t = start; t <= endMs; t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    const file = `epss_scores-${d}.csv.gz`;
    let buf: Buffer | undefined;
    try {
      buf = await cachedDownloadBinary(`https://epss.cyentia.com/${file}`, join(dir, file));
    } catch (e) {
      log(`epss ${d}: ${e instanceof Error ? e.message : e}`);
    }
    if (!buf) {
      missing++;
      continue;
    }
    let text: string;
    try {
      text = gunzipSync(buf).toString("utf8");
    } catch {
      missing++;
      continue;
    }
    let pos = 0;
    while (pos < text.length) {
      const nl = text.indexOf("\n", pos);
      const line = text.slice(pos, nl < 0 ? text.length : nl);
      pos = nl < 0 ? text.length : nl + 1;
      if (line.charCodeAt(0) !== 67 /* C */) continue;
      const c1 = line.indexOf(",");
      const cve = canonical.get(line.slice(0, c1));
      if (!cve) continue;
      const c2 = line.indexOf(",", c1 + 1);
      const score = Math.round(Number(line.slice(c1 + 1, c2 < 0 ? undefined : c2)) * 1000) / 1000;
      if (!Number.isFinite(score)) continue;
      if (last.get(cve) !== score) {
        last.set(cve, score);
        (series.get(cve) ?? series.set(cve, []).get(cve)!).push([d < from ? from : d, score]);
      }
    }
    if (new Date(t).getUTCDate() === 1) log(`epss through ${d}`);
  }
  // A score recorded before the window was moved to the first day; keep only the last of those.
  for (const [cve, pts] of series) {
    const firstIdx = pts.findIndex((p) => p[0] > from);
    const pre = (firstIdx < 0 ? pts : pts.slice(0, firstIdx)).at(-1);
    series.set(cve, pre ? [pre, ...(firstIdx < 0 ? [] : pts.slice(firstIdx))] : pts);
  }
  log(`epss: ${missing} days missing`);
  return series;
}

// ---------- sampling ----------

/** Deterministic PRNG so the sample is reproducible from the seed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample<T>(items: T[], n: number, rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ---------- main ----------

async function main() {
  ensureDir(CACHE);
  log(`window ${FROM} to ${TO}, seed ${SEED}`);
  const kev = await loadKev();
  const cvelist = loadCveList();
  const [metasploit, nuclei, exploitdb, circl, vulncheck] = await Promise.all([loadMetasploit(), loadNuclei(), loadExploitDb(), loadCircl(), loadVulncheck()]);
  const vulnrichment = loadVulnrichment();
  const poc = loadPocGithub();
  log(`signals: metasploit ${metasploit.size}, nuclei ${nuclei.size}, exploitdb ${exploitdb.size}, poc ${poc.size}, circl ${circl.size}, ssvc active ${vulnrichment.active.size}, ssvc poc ${vulnrichment.poc.size}`);

  const hasSignal = (c: string) =>
    metasploit.has(c) || nuclei.has(c) || exploitdb.has(c) || poc.has(c) || circl.has(c) || vulnrichment.active.has(c) || vulnrichment.poc.has(c) || !!vulncheck?.has(c);

  // Stratum kev: every CVE added to KEV from the window start until today.
  const kevIds = [...kev.map.values()].filter((v) => v.dateAdded >= FROM && v.dateAdded <= today).map((v) => v.cveID.toUpperCase()).sort();
  // Candidates: published in the window, CVSS 7 or more, not in KEV.
  const candidates = [...cvelist.values()]
    .filter((s) => s.state !== "REJECTED" && s.published && s.published >= FROM && s.published <= TO && (s.cvss ?? 0) >= CVSS_MIN && !kev.map.has(s.cveId))
    .map((s) => s.cveId)
    .sort();
  const signalIds = candidates.filter(hasSignal);
  const randomPool = candidates.filter((c) => !hasSignal(c));
  const rnd = mulberry32(SEED);
  const signalSample = signalIds.length > SIGNAL_CAP ? sample(signalIds, SIGNAL_CAP, rnd).sort() : signalIds;
  const randomSample = sample(randomPool, Math.min(RANDOM_N, randomPool.length), rnd).sort();
  log(`population: kev ${kevIds.length}, signal ${signalIds.length}, random ${randomPool.length}; sampled ${kevIds.length}/${signalSample.length}/${randomSample.length}`);

  const chosen: [string, Stratum][] = [...kevIds.map((c): [string, Stratum] => [c, "kev"]), ...signalSample.map((c): [string, Stratum] => [c, "signal"]), ...randomSample.map((c): [string, Stratum] => [c, "random"])];
  const cveSet = new Set(chosen.map(([c]) => c));

  // CVE records for KEV members outside 2025 and 2026.
  let fetched = 0;
  for (const [c] of chosen) {
    if (cvelist.has(c)) continue;
    const s = await fetchCveRecord(c);
    if (s) cvelist.set(c, s);
    fetched++;
  }
  log(`fetched ${fetched} older CVE records`);

  const epss = await loadEpss(cveSet, FROM, TO);

  const cves: BacktestCve[] = chosen.map(([cveId, stratum]) => {
    const s = cvelist.get(cveId);
    const k = kev.map.get(cveId);
    const vc = vulncheck?.get(cveId);
    const ssvcActive = vulnrichment.active.get(cveId);
    const ssvcPoc = vulnrichment.poc.get(cveId);
    return {
      cveId,
      stratum,
      published: s?.published,
      cvss: s?.cvss,
      vendor: k?.vendorProject ?? s?.vendor,
      product: k?.product ?? s?.product,
      kev: k ? { dateAdded: k.dateAdded, ransomware: k.knownRansomwareCampaignUse === "Known" } : undefined,
      vulncheckKev: vc ? { dateAdded: vc } : undefined,
      ssvc: ssvcActive || ssvcPoc ? { active: ssvcActive, poc: ssvcPoc } : undefined,
      epss: epss.get(cveId) ?? [],
      metasploit: (metasploit.get(cveId) ?? []).sort(),
      nuclei: nuclei.get(cveId),
      pocGithub: (poc.get(cveId) ?? []).sort((a, b) => a.created.localeCompare(b.created)),
      exploitdb: (exploitdb.get(cveId) ?? []).sort(),
      circl: (circl.get(cveId) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  const dataset: BacktestDataset = {
    builtAt: new Date().toISOString(),
    from: FROM,
    to: TO,
    dataEnd: today,
    historyHorizon: HISTORY_HORIZON,
    sampling: {
      seed: SEED,
      population: { kev: kevIds.length, signal: signalIds.length, random: randomPool.length },
      sampled: { kev: kevIds.length, signal: signalSample.length, random: randomSample.length },
    },
    sources: {
      "cisa-kev": `catalog ${kev.version}`,
      cvelist: `cvelistV5 sparse clone (2025, 2026) read ${today}`,
      vulnrichment: `cisagov/vulnrichment git history since ${HISTORY_HORIZON}`,
      epss: "FIRST EPSS daily bulk files (epss.cyentia.com), scores rounded to 3 decimals, change points only",
      metasploit: `modules_metadata_base.json plus module add dates from git history since ${HISTORY_HORIZON}`,
      nuclei: `cves.json plus template add dates from git history since ${HISTORY_HORIZON}`,
      "poc-github": "nomi-sec/PoC-in-GitHub repository created_at",
      exploitdb: "files_exploits.csv date_published",
      "circl-sightings": "vulnerability.circl.lu sightings (exploited, published-proof-of-concept, confirmed)",
      "vulncheck-kev": vulncheck ? "VulnCheck KEV date_added" : "skipped (no VULNCHECK_API_TOKEN)",
    },
    cves,
  };

  const json = JSON.stringify(dataset);
  const gz = gzipSync(Buffer.from(json), { level: 9 });
  const target = gz.length <= MAX_COMMITTED_BYTES ? OUT : join(CACHE, "dataset.json.gz");
  ensureDir(join(target, ".."));
  writeFileSync(target, gz);
  const sha = createHash("sha256").update(gz).digest("hex").slice(0, 12);
  log(`wrote ${target}: ${cves.length} CVEs, ${(gz.length / 1024 / 1024).toFixed(2)} MB gzipped (${(json.length / 1024 / 1024).toFixed(1)} MB raw), sha256 ${sha}`);
  if (target !== OUT) log(`too large to commit; rebuild with this script (see docs/methodology-rules.md)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
