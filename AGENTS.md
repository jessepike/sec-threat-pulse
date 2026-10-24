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
src/lib/ladder/        ladder types, rung computation, verdict rules (versioned)
src/lib/ingest/        one adapter per source + shared fetch, dedupe, run bookkeeping
src/lib/ingest/__fixtures__/   recorded sample payloads for adapter tests
docs/                  architecture, source registry, design prototypes
```

## Rules

- Never commit secrets. Use environment variables; document them in `.env.example`.
- Plain language in anything a reader sees: short sentences, no em dashes, no marketing phrasing,
  no "X, not Y" constructions. Claims from criminal leak sites are always labeled as claims.
- Every public claim carries a source link and a timestamp. Missing evidence shows as missing.
- Respect source terms (see the registry). Send `User-Agent: SecurityThreatPulse/0.1
  (+https://securitythreatpulse.com; jp@jessepike.dev)` on every request.
- Adapters must be idempotent: re-running a source never creates duplicates (use `dedupe_key`).
- A failed source never breaks the site: record the failure, keep the last good data.
- Tests: every adapter has a fixture-based test. `npm test` must pass before pushing.
- Commit as `jesse@keatingpike.com` (Vercel rejects other authors). Conventional commits.
- Update `status.md` at the end of every session.
- Keep the owner's Claude Doc current as work lands: tick the checkboxes in the decision log, open
  questions, "What exists" and the Build plan backlog, and add new decisions and open questions there.
- Owner feedback arrives as comments on that Claude Doc. At the start of every session, list open
  threads whose newest comment is Jesse's and has no Claude reply. Answer questions in the thread;
  make small, clear changes and reply with what changed; for anything large or ambiguous, reply
  with a recommendation and what you need. Never resolve a thread Jesse wrote in.
