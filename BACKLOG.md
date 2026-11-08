# Backlog

Mirror of the owner's planning doc. Gates decide when a phase is done.

## Phase 0: Foundations · Gate: live site deployed on securitythreatpulse.com (met Oct 24, 2026)

- [x] Repo, data model, agent docs
- [x] Vercel project, Neon database, DNS
- [x] Public site: port of the three prototypes (home, event page, board brief); dark default, grey setting
- [x] Admin console: login, audit log, Overview, Roadmap, Settings
- [x] Security baseline: headers, secret scanning, dependency audit, locked-down admin routes
- [x] Methodology v0, disclosure, terms of use, "not advice" disclaimer, privacy policy, attribution block

## Phase 1: Data spine · Gate: 7 days of unattended fresh updates (clock started Oct 24, 2026)

- [x] Adapters: CISA KEV, VulnCheck KEV, CVE List V5 + Vulnrichment, EPSS, NVD, CIRCL sightings,
      Metasploit, nuclei-templates, PoC-in-GitHub, Exploit-DB, SEC EDGAR 8-K, HIBP, WA AG, CA AG
- [x] Ingest runner, cron route, run bookkeeping
- [ ] Raw archive in R2 (code ready; bucket not created)
- [x] Event grouping, ladder computation, verdict rules v0
- [x] Admin: Sources, Pipeline runs, Events (merge, override with reason)
- [ ] Admin: split an event
- [x] Feed health checks and alerts (GitHub issues labeled `alert`; DELAYED marker on the site)
- [x] Cost alerts: database storage alert at 80% of the Neon free plan (Vercel usage not yet watched)
- [x] Claim-labeling and takedown policy (`docs/policy-claims-and-takedown.md`, approved Oct 25, 2026; public on /methodology)

## Phase 2: Verdict rules · Gate: accuracy measured and near target

- [x] Verdict rules v1, versioned (v0 kept for replay)
- [x] Backtest harness and 18 months of history (`npm run backtest`, `docs/methodology-rules.md`)
- [x] Independent review of the backtest, corrected measurement, rules v2 (active; v0 and v1 kept for replay)
- [ ] Collect vendor confirmed exploitation and VulnCheck KEV for ground truth; rerun
- [x] Admin: Rules, Scorecard; public methodology and changelog (the page renders `docs/methodology-rules.md`)
- [x] Pre listing calls need events before a KEV listing (early events `early-<cve>`; a later KEV listing adopts them)
- [ ] Second exploitation report source so "two independent reports" can confirm without KEV

## Permissions and partnerships (owner sends; agents draft)

- [ ] ransomware.live written approval · VulnCheck agent re-serving · CIRCL data license
- [ ] Shadowserver, GreyNoise, CrowdSec partnership talks (rungs 2 and 3)

## Research and plan (Nov 7, 2026)

- [x] Orientation, gap analysis and five-wave plan (`docs/plan/world-class-plan-2026-11-07.md`)
- [x] SMP as the model (`docs/research/smp-model.md`)
- [x] Leader needs research (`docs/research/leader-needs.md`)
- [x] Comparables and primitives research (`docs/research/comparables-and-primitives.md`)
- [x] Live site review (`docs/research/site-review-2026-11-07.md`)
- [x] Value brief and development approach (`docs/plan/value-brief.md`)
- [x] Owner review: the value brief's five proposed decisions and the revised wave order (accepted Nov 8, 2026)

## Wave 0: Durable floor and autonomy (started Nov 8, 2026) · Gate: 7 days fresh with no session; a staged outage caught within 24 hours

- [x] Public `/status.json` and `/api/v1/health`: last complete sync, last attempt, per-source health, rules version
- [x] Outside-host freshness probe (GitHub Action) that opens and closes `alert` issues (scheduled runs confirmed Nov 8)
- [x] Nightly snapshot of the public API to a `data` branch, CC BY 4.0 for STP's own fields (first commit Nov 8, 12:00 UTC)
- [x] Daily Claude Code routine: feedback issues, alerts, Dependabot, status.md; merges its own PRs on green (`docs/routine.md`, scheduled 4:23 AM Pacific)
- [ ] Hygiene: merge safe Dependabot bumps and hold TypeScript 7 and ESLint 10 (done Nov 8); delete the 9 merged `feat/*` branches (owner); gitleaks-action 3 waits for the owner
- [ ] Probe drill: a staged outage caught within 24 hours (the routine gets 403 on workflow dispatch; owner runs Freshness probe with `simulate: down` from the Actions tab)
- [x] Small fixes from the site review: share-image font error, empty "why it matters" texts, duplicate CIRCL evidence rows, verdict reason template, first-seen date shift, Low count card, feed guids, sample data

## Wave 1: Evidence and product spine (started Nov 8, 2026) · Gate: the top 5 is computable and published with its rule; a 30-question agent test set passes nightly

- [x] `affectedProducts` on every event: every vulnerable vendor/product pair from NVD CPE and the CVE record, canonical names from a hand-kept table (`src/lib/products/`), embedded products from a sourced component table
- [x] The clock per event: disclosure, exploit code, first attack report, KEV listing, federal deadline, each linked to its source
- [x] Independent-source counts per rung
- [x] Richer API fields (`affectedProducts`, `cvss`, `epss`, `exploitMaturity`, `kevListed`, `kevDateAdded`, `kevDueDate`, `clock`, `ladderSources`) and filters (`product`, `cve`, `since`); OpenAPI 3.1 at `/api/v1/openapi.json`; MCP tools take `product` and `since`
- [x] `/events?product=` filter and product chips on event pages
- [ ] Ranking rule for the top 3 to 5 (versioned, backtested) and a tier inside Act now; owner approves the rules version
- [ ] 30-question agent test set run nightly
- [ ] Changes RSS and dated CSV export

## Public repo (owner asked Nov 8, 2026) · Gate: owner flips visibility

- [x] Pre-flight: full-history secret scan, fixture review, MIT LICENSE, README
- [ ] Owner makes the repo public in GitHub settings; CodeQL then runs on its own

## Later phases

3 News and claims · 4 Machine layer (API v1, Act now RSS, llms.txt and MCP server live Oct 25; agent test set to do) · 5 Audience views · 6 Launch
