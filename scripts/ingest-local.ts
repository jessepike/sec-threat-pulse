// Runs adapters against live endpoints WITHOUT a database and prints counts.
// Usage: npx tsx scripts/ingest-local.ts [--only cisa-kev,epss] [--tracked 40] [--json]
import { buildEvents, type EventObservation } from "../src/lib/ladder/events";
import { SOURCE_REGISTRY } from "../src/lib/ingest/registry";
import { mergeVulnerabilityInputs } from "../src/lib/ingest/runner";
import type { ObservationInput, VulnerabilityInput } from "../src/lib/ladder/types";
import { loadLocalEnv } from "./env";

loadLocalEnv();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? "") : undefined;
};
const only = flag("only")?.split(",").filter(Boolean);
const trackedLimit = Number(flag("tracked") ?? 60);
const now = new Date();

async function main() {
  const allObs: ObservationInput[] = [];
  const allVulns: VulnerabilityInput[] = [];
  let tracked: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const def of SOURCE_REGISTRY) {
    const a = def.adapter;
    if (only && !only.includes(a.id)) continue;
    const t0 = Date.now();
    try {
      const r = await a.run({
        fetch,
        now,
        trackedCves: tracked,
        enrichCves: tracked.slice(0, 3),
        env: process.env,
      });
      if (r.skipped) {
        rows.push({ source: a.id, status: "skipped", note: r.skipped, ms: Date.now() - t0 });
        continue;
      }
      allObs.push(...r.observations);
      allVulns.push(...r.vulnerabilities);
      const kinds: Record<string, number> = {};
      for (const o of r.observations) kinds[o.kind] = (kinds[o.kind] ?? 0) + 1;
      rows.push({
        source: a.id,
        status: "ok",
        observations: r.observations.length,
        vulnerabilities: r.vulnerabilities.length,
        kinds: Object.entries(kinds).map(([k, v]) => `${k}:${v}`).join(" "),
        stats: r.stats ? JSON.stringify(r.stats) : "",
        sample: r.observations[0]?.title?.slice(0, 70) ?? r.vulnerabilities[0]?.cveId ?? "",
        ms: Date.now() - t0,
      });
      if (a.id === "cisa-kev") {
        // Newest additions first, like the runner does, capped so the per-CVE sources stay quick.
        const merged = mergeVulnerabilityInputs(r.vulnerabilities);
        tracked = merged
          .sort((x, y) => (y.kevCisaDateAdded ?? "").localeCompare(x.kevCisaDateAdded ?? ""))
          .map((v) => v.cveId)
          .slice(0, trackedLimit);
      }
    } catch (e) {
      rows.push({ source: a.id, status: "ERROR", error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
    }
  }

  console.table(rows);
  if (args.includes("--json")) console.log(JSON.stringify(rows, null, 2));

  // End-to-end preview without a database: group, ladder and verdict.
  const vulns = mergeVulnerabilityInputs(allVulns);
  const obsForEvents: EventObservation[] = allObs.map((o, i) => ({ ...o, id: i + 1 }));
  const events = buildEvents(vulns, obsForEvents, { now, lookbackDays: 14 });
  console.log(`\nEvent preview (KEV additions in the last 14 days): ${events.length} events`);
  for (const e of events.slice(0, 8)) {
    console.log(`  [${e.verdict}] ${e.id}  CVEs:${e.cveIds.length} maturity:${e.exploitMaturity}  ${JSON.stringify(e.ladder)}`);
    console.log(`      ${e.verdictReason}`);
  }

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
