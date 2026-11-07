# STP world-class plan

Mirror of the Claude Doc "STP world-class plan" (https://claude.ai/artifact/PCUTrnFZr7wzZmhY5c4BYv),
written Nov 7, 2026 after orienting on the repo and the live site. The Claude Doc is canonical.

STP becomes the default public answer to "is anything I bought being exploited, and what do I do"
for people and their agents. Build order is agents and data first, then the page, then reach.
Everything runs unattended on the free and keyless sources we already use.

## Decisions taken (Nov 7)

| Question | Decision | What it means for the build |
|---|---|---|
| People or agents first | Deferred to review (open question 1) | The plan keeps agents first for now; `get_brief` builds the same top 3 to 5 the home page needs |
| AI-written text | No API keys | No ANTHROPIC_API_KEY, VulnCheck or NVD key. Write-ups come from scheduled Claude Code sessions that open pull requests, plus fixed templates. Verdicts stay rule-only |
| Release gate | Auto | Data, fixes and page changes deploy once checks pass. Only a new rules version waits for Jess |
| Snapshot license | CC BY 4.0 for STP's own fields | Source terms pass through; withheld sources stay out of the snapshot |
| Routine merges its own PRs | Yes | Screenshots at 1440 and 390 attached to every page change |

## Where it stands

Works today: unattended ingest (29 sources), versioned rules v0 to v2 with an honest backtest,
JSON API v1, MCP server (3 tools), llms.txt, two RSS feeds, takedown policy, corrections log.

| # | Gap | Evidence |
|---|---|---|
| 1 | No top 3 to 5, no "is my vendor hit" | 75 Act now events on the API on Nov 7 |
| 2 | Exposure and Damage rungs never light up | 0 of the first 50 Act now events show them |
| 3 | Accuracy is low and there is no live track record | Early Act now right 35 to 43% in the backtest |
| 4 | The site watches itself | Health check runs inside the Vercel cron it watches; no R2, no export |
| 5 | Agent layer is thin | 3 MCP tools, no OpenAPI, no vendor or since filters, no bulk export, no agent tests |
| 6 | Autonomy stops at the session | No commits for 11 days; 9 Dependabot PRs open 2 weeks |
| 7 | Docs and branches drifted | status.md dated Oct 24; 9 merged branches remain |
| 8 | Small live defects | Share image font error (19 in 7 days); 4 empty "why it matters" texts |

## What to copy from Security Market Pulse

Outside-host freshness probe, fail-closed publication with "last complete" vs "last attempt",
public receipts, two scoring instruments (weekly health check by an agent, monthly outcome review
by a blind scorer), lessons.md, render before claiming better. Details in
[../research/smp-model.md](../research/smp-model.md).

## The plan

Five waves, each ending at a measurable gate.

### Wave 0: Durable floor and autonomy
Gate: 7 days fresh with no session opened; an outside probe catches a staged outage within 24 hours.
- Outside-host freshness probe (GitHub Action) opening `alert` issues
- Public `/status.json`: last complete sync, last attempt, per-source health, rules version
- Nightly snapshot of the public API committed to a `data` branch (rebuild path and bulk download)
- Daily Claude Code routine: feedback issues, alerts, Dependabot, status.md; opens and merges PRs on green
- Hygiene: record the Phase 1 gate, refresh status.md, delete merged branches, hold TypeScript 7 and ESLint 10
- Fix the share-image font error; fill the 4 empty "why it matters" categories

### Wave 1: Agent contract
Gate: a 30-question agent test set passes at 100% on the tool level, nightly.
- OpenAPI 3.1 and JSON Schema, with a versioning and deprecation policy
- Filters `vendor`, `product`, `cve`, `since`, `updated_since`; ETag and Last-Modified; real search
- `check_stack` (vendors in, ranked hits out) as API endpoint and MCP tool
- `get_brief`: the top 3 to 5 this week with reasons
- Per-vendor RSS and JSON Feed
- MCP resources (methodology, rules, policy) and stable evidence ids
- Agent test set with checked answers; nightly tool-level run, monthly end-to-end run

### Wave 2: Verdicts worth trusting
Gate: a public live track record exists and rules v3 beats v2 on held-out data.
- Live track record scored nightly against KEV at 30 days; published at `/track-record`
- Versioned ranking rule for the top 3 to 5, backtested
- Keyless second exploitation sources: MSRC CVRF, ENISA EUVD, vendor PSIRT feeds, CISA ICS
- Vendor and product catalog with an alias table for the top 200 commercial vendors
- Exposure and Damage shown as "not tracked yet" until real sources exist
- Rules v3: backtest, one held-out reveal, Jess approves before it goes live

### Wave 3: Reader product
Gate: clarity panel 14 of 15 or better; blind scorers rate the site "meets intent".
- Home page leads with the top 3 to 5 "do this this week"
- Vendor pages at `/vendors/{slug}`; "your stack" in the URL
- Write-ups for the top 5 from the daily routine as labeled text; a check rejects sentences without an evidence id
- Weekly brief page and RSS from `get_brief`
- Monthly outcome review by two blind scorers, append-only

### Wave 4: Launch (Jess decides each outward step)
- Indexing on, `llms-full.txt`, MCP registry listings
- Permissions: CIRCL license, ransomware.live, VulnCheck re-serving
- Partnership asks for the Exposure and Attempts rungs

## Scorecard targets

| Metric | Today | Target | Moved by |
|---|---|---|---|
| Freshness | Every 15 min, checked only from inside Vercel | 4+ runs a day, confirmed from outside | Wave 0 |
| Coverage of KEV additions | Not measured | 95%+ within one run | Wave 0 |
| Accuracy of an early Act now | 35 to 43% (backtest) | Published live record; v3 better than v2 | Wave 2 |
| Lead time before KEV | 15% of additions, median 4 days | Higher share, same precision | Wave 2 |
| Clarity in 30 seconds | 11 of 15 | 14 of 15 | Wave 3 |
| Agent readiness | 3 tools, no tests | 30-question set at 100% nightly | Wave 1 |
| Running cost | Vercel Pro, Neon free | Under $50 a month | Watched weekly |
