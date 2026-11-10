# Security Threat Pulse

Shared instructions for every agent runtime (Claude, Codex, Cursor, Gemini, Krypton). This file is
canonical; `CLAUDE.md` points here.

## What this is

https://securitythreatpulse.com: a free, automated, vendor-neutral resource that tells security
leaders, CEOs, boards, insurers and investors (and their agents) what is happening in cybersecurity,
what is real, what is noise, and what deserves attention.

Every event sits on an **evidence ladder**: 1 Talk, 2 Exposure, 3 Attack attempts, 4 Confirmed
exploitation, 5 Confirmed damage. Each rung is `confirmed`, `reported` or `none`. Verdicts
(`act_now`, `watch`, `low`) come from versioned rules, never from model opinion.

- **Owner:** Jesse Pike. **Stage:** Build (exploration). Not public yet.
- **Not a SOC tool.** No IOC feeds, detection rules or exploit code.

## Start here

| Read | For |
|---|---|
| [intent.md](intent.md) | Purpose, readers, principles. Changes need the owner's approval |
| [status.md](status.md) | Current state and what is next. Read first every session |
| [BACKLOG.md](BACKLOG.md) | Open work, by phase and gate |
| [decisions.md](decisions.md) | Decisions in force |
| [docs/architecture.md](docs/architecture.md) | How the system works |
| [docs/source-registry.md](docs/source-registry.md) | Every source, its terms and how we automate it |
| [docs/design/](docs/design/) | Approved prototype screens (dark theme primary, grey option) |
| [docs/plan/](docs/plan/) | Mirrors of the owner's plans (world-class plan, value brief) |
| [docs/research/](docs/research/) | Research findings: leader needs, comparables, site reviews, SMP model |
| [lessons.md](lessons.md) | Hot buffer of session lessons. Read at start, add one line when you learn something |
| [docs/routine.md](docs/routine.md) | What the daily scheduled session does, step by step. Change the routine there |

The owner's canonical planning doc (intent, scorecard, roadmap) lives in a Claude Doc; `intent.md`
and `BACKLOG.md` mirror it for agents.

## Stack

Next.js 16 (App Router, TypeScript) on Vercel Pro · Neon Postgres via Drizzle ORM · Auth.js v5
with GitHub sign-in, allowlisted · Vercel Cron for scheduled ingest, GitHub Actions for long
backfills and backtests · Cloudflare for DNS and R2 (raw payload archive) · Vitest for tests.

## Layout

```
src/app/               public site, /admin console, /api (cron, public API)
src/lib/db/            Drizzle schema and client
src/lib/ladder/        ladder types, rung computation, verdict rules (versioned), the clock
src/lib/products/      affected products: canonical names, embedded components, resolver
src/lib/ingest/        one adapter per source + shared fetch, dedupe, run bookkeeping
src/lib/ingest/__fixtures__/   recorded sample payloads for adapter tests
docs/                  architecture, source registry, design prototypes
```

## Rules

- Never commit secrets. Use environment variables; document them in `.env.example`.
- Plain language in anything a reader sees: short sentences, no em dashes, no marketing phrasing,
  no "X, not Y" constructions. Claims from criminal leak sites are always labeled as claims.
- Every public claim carries a source link and a timestamp. Missing evidence shows as missing.
- Named organizations, correction and takedown requests follow `docs/policy-claims-and-takedown.md`.
  Legal demands go to Jesse; never remove or restore content on one yourself.
- Respect source terms (see the registry). Send `User-Agent: SecurityThreatPulse/0.1
  (+https://securitythreatpulse.com; jp@jessepike.dev)` on every request.
- Adapters must be idempotent: re-running a source never creates duplicates (use `dedupe_key`).
- A failed source never breaks the site: record the failure, keep the last good data.
- `/status.json` is the public health report (last complete run, last attempt, per-source health). An
  outside probe reads it from GitHub Actions every 30 minutes and opens `alert` issues when the site
  is stale. The nightly snapshot on the `data` branch is the rebuild path and the bulk download.
- Tests: every adapter has a fixture-based test. `npm test` must pass before pushing. After a
  deploy, `npm run smoke` checks the live pages, API, feeds, MCP server and phone layout.
- Commit as `jesse@keatingpike.com` (Vercel rejects other authors). Conventional commits.
- Update `status.md` at the end of every session. Keep it to the current state and about a week of entries;
  move older entries to `docs/status-archive.md`.
- Keep the owner's Claude Doc current as work lands: tick the checkboxes in the decision log, open
  questions, "What exists" and the Build plan backlog, and add new decisions and open questions there.
- **Owner feedback comes first.** Jesse leaves feedback on the admin Roadmap page
  (/admin/roadmap, "Feedback for agents"). Each note is a GitHub issue labeled `feedback`. At the
  start of every session, list the open ones:
  `gh api "repos/jessepike/sec-threat-pulse/issues?labels=feedback&state=open" --jq '.[] | "#\(.number) \(.title)"'`
  then read each (`gh api repos/jessepike/sec-threat-pulse/issues/<n>` and its `/comments`).
  Make small, clear changes, reply on the issue with what changed (commit and page), and close it
  (`gh api -X PATCH repos/jessepike/sec-threat-pulse/issues/<n> -f state=closed`). For anything
  large or ambiguous, reply with a recommendation and what you need, and leave it open.
- Source alerts come next. The outside probe owns every issue labeled `alert`: site freshness (no
  complete run in 75 minutes), one per source that has failed 3 runs in a row or has not succeeded
  in 3 intervals (3 hours at least), database storage (`database-size`, 80% of the Neon free plan)
  and a failed post-deploy smoke test. The site opens none itself. List them with `labels=alert`
  the same way, fix the cause, and reply. Each issue closes itself on recovery. The site strip shows
  DELAYED when nothing has updated for an hour.
- One scheduled run every 30 minutes (`/api/cron/ingest`) ingests and then rebuilds events. Keep it
  one invocation: Neon's free plan sleeps after 5 idle minutes and allows 100 compute hours a month,
  so each extra scheduled touch of the database costs about 5 minutes of compute.
- Migrations stay additive (`src/lib/db/migrations.test.ts` fails on a drop, rename or tightening).
- `npm run backup:local` writes every table to `~/stp-backups/`, outside the repo. Never commit one.
- Comments on the Claude Doc are also feedback: check open threads whose newest comment is Jesse's
  and has no Claude reply, and handle them the same way. Never resolve a thread Jesse wrote in.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
