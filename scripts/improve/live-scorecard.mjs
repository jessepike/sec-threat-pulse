#!/usr/bin/env node
// The live half of the improve loop's scorecard. Runs nightly from GitHub Actions (snapshot.yml),
// because the live site cannot be reached from the cloud sessions the loop runs in, and writes
// improve/live.json to the data branch. Reads only public, cached endpoints, so it adds no
// scheduled database work. A protected file: changing it needs the tier 2 review panel.
//
// Usage: node scripts/improve/live-scorecard.mjs <out.json> [base-url]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = process.argv[2];
if (!out) {
  console.error("usage: live-scorecard.mjs <out.json> [base-url]");
  process.exit(2);
}
const base = (process.argv[3] ?? "https://securitythreatpulse.com").replace(/\/$/, "");
const UA = "SecurityThreatPulse/0.1 (+https://securitythreatpulse.com; jp@jessepike.dev)";
const here = dirname(fileURLToPath(import.meta.url));
const errors = [];

async function getJson(p) {
  try {
    const res = await fetch(base + p, { headers: { "user-agent": UA, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    errors.push(`${p}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? Number(x.toFixed(4)) : null);
const metrics = {};

const status = await getJson("/status.json");
const list = Array.isArray(status?.sources?.list) ? status.sources.list : [];
metrics["live.sourcesOk"] = status ? list.filter((s) => s?.state === "ok").length : null;

const tr = await getJson("/api/v1/track-record");
metrics["live.actNowRate"] = num(tr?.live?.actNow?.overall?.rate);
metrics["live.kevCalledBeforeShare"] = num(tr?.live?.kevCoverage?.share);

let actNow = 0;
let early = 0;
let ok = true;
for (let page = 1, pages = 1; page <= pages && page <= 50; page++) {
  const d = await getJson(`/api/v1/events?verdict=act_now&page=${page}`);
  if (!d) {
    ok = false;
    break;
  }
  pages = d.pages ?? 1;
  for (const e of d.events ?? []) {
    actNow += 1;
    if (!e.kevListed) early += 1;
  }
}
metrics["live.earlyActNowShare"] = ok && actNow ? num(early / actNow) : null;

let agentTests = null;
try {
  const raw = execFileSync(process.execPath, [join(here, "..", "agent-tests.mjs"), base, "--json"], { encoding: "utf8", env: { ...process.env, GITHUB_TOKEN: "" }, timeout: 600_000 });
  agentTests = JSON.parse(raw);
} catch (e) {
  // The script exits 1 when a question fails; its JSON is still on stdout.
  const stdout = e && typeof e === "object" && "stdout" in e ? String(e.stdout) : "";
  try {
    agentTests = JSON.parse(stdout);
  } catch {
    errors.push(`agent tests: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
  }
}
metrics["live.agentTestsPassRate"] = agentTests?.total ? num(agentTests.passed / agentTests.total) : null;

const card = {
  at: new Date().toISOString(),
  base,
  metrics,
  detail: {
    sources: list.map((s) => ({ id: s.id, state: s.state })),
    actNowEvents: actNow,
    agentTestsFailed: agentTests?.failed ?? null,
  },
  errors,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(card, null, 2) + "\n");
console.log(`wrote ${out}: ${JSON.stringify(metrics)}${errors.length ? `; errors: ${errors.join("; ")}` : ""}`);
