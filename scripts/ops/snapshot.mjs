#!/usr/bin/env node
// Nightly snapshot of the public API. Writes a dated, self-describing copy of every visible event
// so the site can be rebuilt from it and agents can download it in bulk. Runs from GitHub Actions
// (.github/workflows/snapshot.yml), which commits the output to the `data` branch.
//
// Usage: node scripts/ops/snapshot.mjs <out-dir> [base-url]
// Only what the public API serves is copied: sources whose terms do not allow re-serving stay out,
// as they do in the API. STP's own fields (verdict, ladder, rules version, titles, plain text) are
// CC BY 4.0; each evidence item carries its source's own terms.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const out = process.argv[2];
if (!out) {
  console.error("usage: snapshot.mjs <out-dir> [base-url]");
  process.exit(2);
}
const base = (process.argv[3] ?? "https://securitythreatpulse.com").replace(/\/$/, "");
const UA = "SecurityThreatPulse/0.1 (+https://securitythreatpulse.com; jp@jessepike.dev)";
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function getJson(p) {
  const res = await fetch(base + p, { headers: { "user-agent": UA, accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`${p} answered ${res.status}`);
  return res.json();
}

const started = new Date();
const status = await getJson("/status.json");
const events = [];
let apiVersion = null;
let page = 1;
let pages = 1;
do {
  const d = await getJson(`/api/v1/events?page=${page}`);
  apiVersion = d.apiVersion ?? apiVersion;
  pages = d.pages ?? 1;
  events.push(...(d.events ?? []));
  page += 1;
} while (page <= pages && page <= 50);

const details = [];
for (const e of events) {
  const d = await getJson(`/api/v1/events/${encodeURIComponent(e.id)}`);
  details.push(d.event ?? d);
}

await mkdir(path.join(out, "events"), { recursive: true });
const files = {};
const write = async (rel, data) => {
  const text = typeof data === "string" ? data : `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(path.join(out, rel), text);
  files[rel] = { sha256: sha(text), bytes: Buffer.byteLength(text) };
};

const day = started.toISOString().slice(0, 10);
const license = {
  stpFields: "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Attribute as: Security Threat Pulse, https://securitythreatpulse.com",
  stpFieldsCovered: ["id", "url", "title", "verdict", "verdictReason", "rulesVersion", "ladder", "category", "firstSeenAt", "updatedAt", "newestEvidenceAt", "fix"],
  sourceData: "Each evidence item (title, url, publishedAt, source) stays under its own source's terms, named in source.attribution and in docs/source-registry.md. Sources whose terms do not allow re-serving are not in this snapshot, as in the API.",
  notAdvice: "Verdicts follow the published rules at https://securitythreatpulse.com/methodology. Not advice.",
};
await write("status.json", status);
await write("events.json", { snapshotAt: started.toISOString(), apiVersion, rulesVersion: status.rulesVersion ?? null, total: events.length, license, events });
for (const d of details) await write(`events/${d.id}.json`, d);
await write("license.json", license);
await write(
  "README.md",
  `# Security Threat Pulse: data snapshot

Taken ${started.toISOString()} from ${base}. Rebuilt every night by \`.github/workflows/snapshot.yml\` on the \`main\` branch.

- \`events.json\`: every visible event as the API lists it (${events.length} events), with the rules version and the license.
- \`events/<id>.json\`: one file per event with its dated, linked evidence, as \`/api/v1/events/<id>\` serves it.
- \`status.json\`: the site's health report at snapshot time (last complete run, last attempt, per-source health).
- \`manifest.json\`: SHA-256 and size of every file, so a copy can be checked.

License: STP's own fields are CC BY 4.0; attribute as "Security Threat Pulse, https://securitythreatpulse.com".
Evidence items stay under their source's terms. Sources that do not allow re-serving are not here. Not advice.
`,
);
const manifest = { snapshotAt: started.toISOString(), day, base, events: events.length, files };
await writeFile(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`snapshot: ${events.length} events, ${Object.keys(files).length + 1} files, ${Math.round((Date.now() - started.getTime()) / 1000)}s`);
