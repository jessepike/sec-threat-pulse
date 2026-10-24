# Architecture

Status: Phase 0 to 1 design, Oct 24, 2026.

## Data flow

```
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
| Attack attempts | Telemetry partner data (later), or 2+ independent reports | 1 report (news, vendor, CIRCL sighting) |
| Exploited | CISA KEV, VulnCheck KEV, vendor "exploited" flag, CISA ADP SSVC `active` | CIRCL `exploited` sighting, news report |
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
`(ladder, context) -> { verdict, reason }`. Changing rules means adding a new version, never editing
an old one, so the backtest can replay any version. v0 is a placeholder until Phase 2.

## Failure handling

A failing source records `status=error` and `last_error`, keeps its last good data, and raises an
alert after 2 consecutive failures. The site never depends on a live source call at request time.
