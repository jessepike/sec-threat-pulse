# Security Market Pulse as the model

Read Nov 7, 2026 from the sibling repo (`/Users/jessepike/code/projects/sec-market`, live at
https://securitymarketpulse.com). Owner direction: use SMP as the model for tech stack and
architecture, durability, eval and scoring, and autonomy. This note records what SMP does, what
transfers to STP, and what does not.

## What SMP is

A practitioner's read on the business of the security market: who is growing, stalling,
consolidating or in trouble, for security leaders first. Facts only from the machine (decision
D-76); judgments only when the owner writes them. Light theme only. About 440 commits.

## Stack

| Layer | SMP | STP today | Transfer? |
|---|---|---|---|
| Framework | Vite + React 19, prerendered static HTML, served from Vercel `web/dist` | Next.js 16 App Router, server components, Vercel | Keep Next.js. STP needs server routes (API, MCP, cron). Copy the idea that every public page also exists as static, cacheable output |
| Data | Frozen TypeScript data modules in `web/src/data`, hashed in a snapshot manifest; no database | Neon Postgres via Drizzle | Keep Postgres. Copy the snapshot manifest: a nightly committed JSON export with hashes is the rebuild path and the "what is live" answer |
| Charts | Recharts | None | Adopt a small charting layer (Recharts or hand-rolled SVG) for sparklines and the top-N glance view |
| Tests | oxlint, `node --test` data tests (271), Playwright browser suite (39) run against the built site, Lighthouse and axe in scoring | Vitest unit and adapter tests, `npm run smoke` after deploy | Add a browser suite against the built site at 1440 and 390, and axe |
| Build gates | `verify:edition`, `verify:panel`, `verify:integrity`, `verify:issue`, `verify:prints`, `verify:tracker`, `verify:dist` all run inside `npm run build`; a failing check fails the deploy | Build has no data gates | Add build-time gates: every public claim has a source and a date, every event id is stable, the methodology page matches the active rules version |
| CI | GitHub Actions on `web/**`: lint, test | CI, CodeQL, gitleaks, Dependabot | Equivalent. Add the browser suite |
| Deploy | `preview` branch is the trunk with a stable URL; `main` is production and moves only by fast-forward promotion; a pre-push hook refuses direct pushes to `main` | `main` deploys to production on merge | Jess chose auto for STP. Keep merge-to-main deploys, but copy the pre-push hook idea for the one thing that still waits: a new rules version |

## Durability

| SMP mechanism | File | STP version |
|---|---|---|
| Outside-host freshness probe: a daily GitHub Action curls the live site, reads the issues index, opens or updates a GitHub issue when stale. Runs off the host it watches on purpose | `.github/workflows/freshness.yml` | Same shape: probe `/api/v1/events` `generatedAt`, newest evidence date, both feeds, `/status.json`. Opens an `alert` issue. STP's current health check runs inside the Vercel cron it watches, so this is the biggest gap |
| Fail-closed data publication: a refresh publishes only when 100% of required logical claims are verified within their freshness window; otherwise the last complete snapshot is retained and the public receipt says "held attempt" | `web/scripts/refresh-publication-gate.mjs`, `web/scripts/app-release.mjs` | The events sync only replaces published state when its own checks pass. Separate "last complete sync" from "last attempt" in `/status.json` and on the status strip |
| App-only vs data release: an app deploy proves it did not change published data (hash manifest) | `app-release.mjs` `appOnlyDecision` | A deploy must not change verdicts unless the rules version changed. Add a check that replays the active rules against a fixture and compares |
| Public receipts: `/refresh-coverage.json`, `/refresh-attempt.json`, `/app-release.json` | `web/dist/*.json` | `/status.json` and a per-run receipt in the admin and the API |
| Health monitor that reads the public receipt and manages one GitHub issue | `scripts/refresh-health.mjs` | Already partly there (`src/lib/ingest/health.ts`); move the trigger off Vercel |
| Source resilience: three attempts, an alternate URL per source, "degraded" marker when more than half fail | `docs/active/durability-spec.md` section 6 | Add alternates for the big sources (KEV mirror already exists) and a degraded marker on the strip |
| Drift: `engines.node` pinned, `npm ci` only, a monthly version-mismatch reminder | durability-spec section 8 | Pin `engines.node`; the daily routine reports Dependabot majors instead of merging them |

## Eval and scoring

| SMP instrument | What it does | STP version |
|---|---|---|
| Site rubric v3.0, 11 weighted dimensions, fit-for-purpose blockers that fail the whole score regardless of points | `docs/active/fable-run/site-rubric.md`. Freshness 22, coverage 15, deciding from facts 20, evidence legibility 13, trust 12, density 4, phone 4, accessibility 4, performance 3, machine legibility 2, craft 1 | Write an STP rubric from `intent.md`'s scorecard. Candidate weights: accuracy and lead time 25, freshness 20, clarity in 30 seconds 15, trust (sources, corrections, AI labels) 15, agent readiness 10, coverage 10, phone and accessibility 5. Blockers: a verdict with no source, a stale strip, an unlabeled AI sentence, a broken feed |
| Blind scorers: two models score the live preview without reading build notes or status; each produces captures, DOM measurements, Lighthouse and axe output, and checks 16 figures against primary sources | `docs/active/auto/score/opus/score.md`, `.../sol/` | Monthly blind score of the live site by two fresh agents, checking 15 verdicts against their evidence and KEV. Append-only under `docs/score/` |
| Two instruments: a monthly outcome review (states, not scores, by someone who did not build it) and a per-edition health check (pass, fail, exception, by an agent) | `docs/active/project-scorecard.md` | Weekly health check by the daily routine; monthly outcome review by a blind agent. Never let the builder score its own outcome |
| Evidence UX rules: every material claim carries evidence ids, supporting and conflicting evidence render separately, NO-CALL and INSUFFICIENT COVERAGE stay visible | `docs/active/web-mvp-product-contract.md` | STP has most of this. Add visible "not tracked yet" for the Exposure and Damage rungs instead of "none" |
| Design bake-off: three models redesign the front page from first principles on real data, judged against a brief (easy on the eyes, digestible, intelligence dense, forward looking; Cloudflare Radar, Stripe, Linear as references) | `docs/active/design-bakeoff/brief.md` | Worth repeating for STP's home page once the top 3 to 5 exists. Keep the brief's hard constraints: facts with sources, honest gaps, 1440 and 390, real data |

## Autonomy

| SMP rule | STP equivalent under Jess's Nov 7 answers |
|---|---|
| A machine publishes sourced, machine-validated facts with automated checks as the only gate (D-76). Judgments only from the owner | STP verdicts come from versioned rules, which the owner approved once. Rule output is a fact about the rules, so it publishes automatically. A new rules version is the judgment and waits for Jess |
| Owner approval of the weekly PR (or a `publish` comment) is the signature; a workflow does the rest | STP: the daily routine opens and merges its own PRs when checks pass (approved Nov 7). Only a rules-version PR needs Jess's approval. Reuse SMP's "approval comment triggers a workflow" pattern for that one case |
| A failed run and a quiet week must never look the same | Status strip and `/status.json` show three states: updated, no change, collection incomplete |
| `lessons.md`: one line per insight, newest first, kept to about 15 | Add to STP, read at session start |
| Decision log numbered D-nn with the owner's words | STP's `decisions.md` is a dated table. Keep it, add ids |

## What not to copy

- Static data modules in place of a database. STP ingests 29 sources every 15 minutes; Postgres is right.
- The preview-then-promote branch model. Jess chose auto for STP.
- Light theme only. STP's approved design is dark with a grey option.
- Weekly cadence and signed issues. STP is continuous.
- SMP's long status.md. STP's rule is a short status with the last session's state.

## Findings that matter most

1. The outside probe and fail-closed publication are the two mechanisms that make SMP durable. STP has neither.
2. SMP's rubric with blockers is the reusable eval. The blind-scorer practice is what makes it honest.
3. SMP's own blind score on Sep 26 was 51.4 of 100 with four blockers, mostly stale or mislabeled figures. The lesson for STP: freshness and labeling checks have to run by machine on every build, not by reviewers after the fact.
