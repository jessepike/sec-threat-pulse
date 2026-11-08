# Architecture

Status: Phase 0 to 1 design, Oct 24, 2026.

## Data flow

```
Vercel build: scripts/db-migrate.mjs applies pending Drizzle migrations (production only), then next build
Vercel Cron (every 15 min) -> /api/cron/ingest  (CRON_SECRET)
   picks sources whose interval has elapsed
   v
adapter.run()  -> AdapterResult { observations, vulnerabilities, raw, cursor }
   v
ingest runner: records source_runs, hashes raw payload (R2 when configured),
upserts vulnerabilities by CVE, inserts observations (dedupe_key unique, idempotent)
   v
/api/cron/events (after ingest): group observations into events, compute ladder,
apply verdict rules (versioned), write verdict_history on any change
   v
Public pages (server components, revalidate 5 min) read events + observations
/admin (Auth.js, GitHub allowlist) reads and writes with audit_log
```

GitHub Actions run long jobs Vercel functions should not: historical backfill and the backtest.

## Evidence ladder

Each rung is `confirmed`, `reported` or `none`, computed from observations:

| Rung | Confirmed by | Reported by |
|---|---|---|
| Talk | 2+ independent talk or advisory observations | 1 talk observation |
| Exposure | Exposure figure from a government or vendor advisory | Exposure figure quoted in news (strength `quoted`) |
| Attack attempts | Telemetry (Shadowserver honeypot sightings via CIRCL, partners later), 2+ independent reports, or confirmed exploitation (an exploitation is a successful attempt) | 1 report (news, vendor, CIRCL sighting), or reported exploitation |
| Exploited | CISA KEV, VulnCheck KEV, vendor "exploited" flag, CISA ADP SSVC `active` | CIRCL `exploited` sighting from a news, social or other non catalog source; news report |
| Damage | SEC 8-K, state AG notice or HIBP breach linked to the event | Never from leak-site claims alone (those stay `claim`) |

Exploit maturity is shown beside the ladder: `none`, `poc` (PoC-in-GitHub, Exploit-DB, CIRCL PoC
sighting) or `weaponized` (Metasploit module, nuclei template).

## Events (Phase 1 grouping)

- A KEV addition creates or joins an event. CVEs for the same vendor and product added within 3
  days of each other share one event.
- Observations attach to events through their CVE IDs. Observations with no CVE wait for Phase 3
  news grouping.
- Event IDs are stable slugs. Admins can merge, split, rename or hide events (audited).

## Verdict rules

Versioned in `src/lib/ladder/rules/`. Each version is a pure function
`(ladder, context) -> { verdict, reason }`. The context carries exploit maturity, EPSS, the KEV
ransomware flag, vendor and product, CVSS, days since the CVE was published and the PoC repository
count. Changing rules means adding a new version, never editing an old one, so the backtest can
replay any version. v2 is current; v0 and v1 stay for replay. Reader-facing wording fixes for frozen
versions live in `rules/reasons.ts`. [docs/methodology-rules.md](methodology-rules.md) describes v2
and the corrected backtest.

## Backtest

`scripts/backtest/build-dataset.ts` assembles point in time signal timelines from public history
(KEV dates, Vulnrichment git history for SSVC, daily EPSS files, Metasploit and nuclei git history,
PoC-in-GitHub, Exploit-DB, CIRCL sightings) into `data/backtest/dataset.json.gz`.
`src/lib/backtest/` replays any rules version day by day and scores it (pure, tested). CIRCL
sightings go through the live adapter's own mapping (`circlRung`), with a one day ingest lag.
Ground truth is CISA KEV, VulnCheck KEV and vendor confirmation. Calls are placed in the tuning or
held-out period by the day they were made. `npm run backtest -- --rules v2` prints the tuning
period scorecard; held-out results need `--reveal-heldout`, and every reveal is appended to
`reports/backtest/heldout-reveals.log`. `scripts/backtest/sensitivity.ts` and `signal-study.ts`
reproduce the alternative views and single signal figures in `docs/methodology-rules.md`.

## Products and the clock (Wave 1)

| Piece | Where | What |
|---|---|---|
| CPE pairs | `vulnerabilities.cpes` | Every vulnerable `vendor/product` pair NVD lists (first 60) plus the CVE record's `affected` entries, unioned on upsert |
| Canonical products | `src/lib/products/` | `resolveAffectedProducts` merges KEV, CVE record and CPE mentions into display names from a hand-kept table (`table.ts`), title-casing the rest; `EMBEDDED` lists products that ship a component, each with a reference link |
| On events | `events.affected_products` | Rebuilt by every sync; the API, the event page chips and the `/events?product=` filter read it |
| The clock | `src/lib/ladder/clock.ts` | Disclosure (CVE record), first public exploit, first attack or exploitation report, KEV listing and federal deadline, each with the observation that set it; distinct sources per rung |
| Contract | `/api/v1/openapi.json` | OpenAPI 3.1; one Event schema shared by the list, the detail and the MCP tools. `v1.test.ts` checks the schema's required fields match the summary type |

## Operations: the durable floor (Wave 0, Nov 8, 2026)

Two clocks are published and kept apart, as Security Market Pulse does: the **last complete** run
(the events cron finished and pages were rebuilt) and the **last attempt** (anything ran, success or
not). A site that keeps attempting and never completes is `delayed`, and says so.

| Piece | Where | What it does |
|---|---|---|
| Health report | `/status.json`, `/api/v1/health` (`src/lib/api/health.ts`) | State `ok`, `delayed` or `down`; last complete and last attempt; per-source health; rules version; counts. 503 only when there is no data at all |
| Outside probe | `.github/workflows/freshness.yml`, `scripts/ops/freshness-probe.mjs` | Every 30 minutes from GitHub Actions, never from Vercel. Opens one issue labeled `alert` ("[alert] Site freshness: ...") when the last complete run is older than an hour or the report fails; closes it on recovery. `workflow_dispatch` with `simulate` drills the alert path |
| Inside health check | `/api/cron/ingest` after each run (`src/lib/ingest/health.ts`, `alerts.ts`) | Per-source alerts, events cron, database size. Goes quiet when the cron dies; the probe covers that |
| Nightly snapshot | `.github/workflows/snapshot.yml`, `scripts/ops/snapshot.mjs` | Copies the public API to the `data` branch every night: `events.json`, one file per event, `status.json`, `manifest.json` with SHA-256 per file. STP fields CC BY 4.0; source data keeps its terms; withheld sources stay out |
| Daily routine | `docs/routine.md`, a scheduled Claude Code session | Feedback issues, alerts, Dependabot, status.md; opens and merges its own pull requests on green |

## Failure handling

A failing source records `status=error` and `last_error`, keeps its last good data, and raises an
alert after 2 consecutive failures. The site never depends on a live source call at request time.
