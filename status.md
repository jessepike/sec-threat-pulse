# Status

Updated Nov 8, 2026, 21:00 UTC. The site is live with real data at https://securitythreatpulse.com.

**Nov 8 session, Wave 3 started: home page top 5.** MSRC PR #23 merged (CI green, Codex clean). The home hero now reads "DO THIS FIRST": one sentence for the week from fixed templates (Act now count, how many are in the Act today tier) and the top 5 Act now in rank order, each with its TODAY badge, first step and CVE ids. The single hero event and its blurb are gone. Watch never pads the list; a month with only older Act now events says so and points at the events list. The same list is `/api/v1/brief` and the MCP tool `get_brief`, and RSS at `/brief/feed.xml` (one item per week). `/api/v1/check-stack?products=` and the MCP tool `check_stack` return the Act now and Watch events naming each vendor or product. OpenAPI, llms.txt, smoke and agent questions 32 and 33 cover them. Next: vendor pages, the live chart, NEW and CHANGED markers.

**Nov 8 session, Wave 2 started: live track record.** The owner said "approve all, continue" and then "continue all waves, no added hosting expense unless approved". Merged Dependabot PR #3 (gitleaks-action 3, CI green). Shipped `/track-record`, `/api/v1/track-record` and the MCP tool `get_track_record`: every early Act now (made before a CISA or VulnCheck KEV listing) is scored per CVE as right (listed within 30 days), wrong (30 days passed) or pending, split by the rules version that made the call, with Wilson intervals, the share of KEV listings since history began that had an Act now first, median lead, Watch at 90 days, and every call listed. Adopted early events keep their call (the CVE is read from the `early-` id). Admin overrides are not scored. The backtest per version sits beside it (v3 shows v2's report, same verdicts). Live history starts Oct 24, so the first early calls settle around Nov 23 unless KEV lists them sooner. OpenAPI, llms.txt, sitemap, footer, smoke test and agent question 31 cover it. PR #21 merged after two Codex fixes (a cluster formed at listing no longer lends its early call to CVEs that joined later; hidden titles stay hidden). Then: Exposed and Damage read "not tracked yet" on flaw events when empty, with the reason, and the API and CSV carry `untrackedRungs`. Then the `msrc` adapter: Microsoft's CVRF documents from the last 70 days, "Exploited:Yes" as vendor confirmed exploitation, which can open an early event before KEV. Its fixture is hand-built because the build container cannot reach the MSRC host; the first production run is the real check (source health on /status.json).

**Nov 8, rules v3 activated.** The owner approved v3 at 16:26 UTC. `CURRENT_RULES_VERSION` is v3, the changelog has the entry, the methodology section reads as live, and the admin scorecard reads v2's backtest report for v3 because the verdicts are v2's (`verdictsFrom`). The first events sync after deploy stamps every event with v3, a tier and a score; no verdict moves, so no history rows and no changes feed entries. Wave 1 is complete.

**Nov 8 daily routine (first run).** No feedback or alert issues open. `/status.json` at 12:24 UTC: ok, last complete run 12:22 UTC, 28 of 29 sources ok (VulnCheck unconfigured), 112 events (75 Act now, 37 Watch, 0 Low). Nightly snapshot committed to `data` at 12:00 UTC; the freshness probe ran at 11:29 UTC. Open Dependabot PRs are all majors: TypeScript 7, ESLint 10 and `@types/node` 26 held as listed; gitleaks-action 3 (Node 24 runtime only, CI green) waits for the owner. The probe drill could not run: the routine's GitHub access gets 403 on workflow dispatch, so the owner runs it from the Actions tab. Nine old `feat/*` branches stay until the owner confirms they were squash merged. Wave 0 boxes ticked in BACKLOG.md.

**Nov 8 session, changes feed and export.** The last Wave 1 item. `/api/v1/changes` lists every verdict or ladder change on a visible event, newest first, with the state it replaced (kinds: new, verdict, ladder, admin; default 7 days, at most 90, 100 a page), read from `verdict_history` with a window function. The same items are RSS at `/events/changes.xml`. `/api/v1/export/events-YYYY-MM-DD.csv` and `.json` export today's events at a dated URL with a `Link: rel="license"` header and the CC BY 4.0 text; `events-latest.*` redirects to today's file; earlier days point at the data branch. OpenAPI, llms.txt and the smoke test cover both. Wave 1 is complete apart from the owner's decision on v3.

**Nov 8 session, agent test set.** 30 questions an agent asks the live site (`npm run agent-tests`): health and freshness, llms.txt, OpenAPI and required fields on live rows, CORS, Act now list and rank order, tier and score consistency, ladder shape and entailment, verdict reasons, vendor, CVE and since filters, paging, 400 and 404 behaviour, event detail (evidence links and dates, ladder backed by evidence, clock, products, KEV fix), human page agreement, MCP tools list and the three tools against the API, the Act now feed. Runs nightly at 05:17 UTC from GitHub Actions and keeps one `alert` issue while any fail. Verified mechanically against a local sample-mode build (data checks need the live site). Next: changes RSS and dated CSV export.

**Nov 8 session, outage fix.** Pull requests 16 and 17 each took the live site down for about 15 minutes: the new build selected columns that the next cron tick had not yet added. Migrations now run in the Vercel build (`scripts/db-migrate.mjs`, production only) before `next build`; the cron routes keep applying them as a fallback. Migrations must stay additive.

**Nov 8 session, later still (Wave 1: ranking rule draft).** Pull request 16 merged after Codex and Vercel review fixes (clock dates never backdated to disclosure, attempts count as a source union, `since` also matches newly attached evidence). Drafted rules v3: v2 verdicts unchanged, plus an "Act today" tier inside Act now (confirmed exploitation within 14 days, and internet-facing, ransomware or attack tools) and a 0 to 11 ranking score with one plain line per factor. A tier study over every KEV addition on the tuning period sized the list (median 5 CVEs a day at 14 days; 7 at 21; 10 at 30). Wired through events sync (`tier`, `rank_score`, `rank_why`, migration 0004), list order (verdict, tier, score, recency), the API and OpenAPI, the event page ("WHY IT RANKS HERE") and a TODAY badge. Inactive until the owner approves: `CURRENT_RULES_VERSION` stays v2, so nothing changes for readers yet. Next: owner decision on v3; agent test set; changes RSS.

**Nov 8 session, later (Wave 1: evidence and product spine, first pull request).** The owner confirmed the value brief's recommendations and asked whether the findings were being built; answer: Wave 0 covered plumbing, the product work starts now. Shipped: `affectedProducts` on every event (NVD CPE pairs and CVE record `affected` entries stored on `vulnerabilities.cpes`, canonical names and embedded components from `src/lib/products/`), the clock per event (disclosure, exploit code, first attack report, KEV listing, federal deadline, each linked), distinct sources per rung, richer API fields and `product`, `cve` and `since` filters, OpenAPI 3.1 at `/api/v1/openapi.json`, MCP tools with `product` and `since`, product chips and a `/events?product=` filter. Migration 0003 adds the two jsonb columns; the cron routes apply it. Existing events get their products on the next events sync (CPE pairs fill in as NVD and the CVE list re-enrich tracked CVEs). Next: the ranking rule for the top 3 to 5 as a backtested draft for the owner, the agent test set, the changes RSS.

**Nov 8 session (Wave 0: durable floor and autonomy).** The owner accepted the value brief's five decisions ("Continue") and Wave 0 started. Shipped on one pull request: public `/status.json` and `/api/v1/health` (last complete run kept apart from last attempt, per-source health, rules version, counts); an outside freshness probe in GitHub Actions every 30 minutes that opens and closes `alert` issues, with a drill mode; a nightly snapshot of the public API to the `data` branch (CC BY 4.0 for STP's fields, manifest with hashes); the daily routine written down in `docs/routine.md` and scheduled as a Claude Code session; dependency bumps (React 19.3.1, checkout 7, setup-node 7, CodeQL action 4; TypeScript 7, ESLint 10, `@types/node` 26 and gitleaks 3 held); CodeQL gated on repo visibility because the private repo cannot enable Code scanning. Small fixes from the site review: share-image font error (symbol glyphs removed), a real "what it is" line for unclassified software plus Fortinet and Brotli patterns, duplicate evidence rows collapsed by source, title and day, the v2 recency sentence reworded, midnight UTC first-seen dates shown as dates, the Low count hidden while the rules produce none, permanent feed guids, sample previews without the ransomware.live tile. Later on Nov 8: the owner asked about making the repo public; recommended yes and shipped the pre-flight (history scan clean, fixtures reviewed, MIT LICENSE, README). GitHub had not started the new probe and snapshot schedules four hours after merge (private repo scheduler delay); the drill and first snapshot still need confirming. Next: owner flips visibility and deletes the 9 merged `feat/*` branches; watch the gate (7 days fresh with no session); then Wave 1 (evidence and product spine).

---

Previous status (Nov 7) follows.

Updated Nov 7, 2026. The site is live with real data at https://securitythreatpulse.com and has run unattended since Oct 24 (no source alerts open on Nov 7; API generated 04:09 UTC with evidence from 01:56 UTC).

**Phase:** 0 and 1 live. The Phase 1 gate (7 days of unattended fresh updates, clock started Oct 24) was met by Oct 31 on the evidence of the live API; no session recorded it until Nov 7. Phase 2 measured; v2 active.

**Nov 7 session (research and plan, no code):** gap analysis and a five-wave plan (`docs/plan/world-class-plan-2026-11-07.md`, canonical in the owner's Claude Doc "STP world-class plan"); four research memos under `docs/research/` (leader needs, comparables and primitives, live site review with 12 screenshots, SMP as the model); a value brief with a revised wave order and five proposed decisions (`docs/plan/value-brief.md`). Owner decisions: no API keys, auto deploys, CC BY 4.0 for STP's own fields, the daily routine may merge its own PRs, build order deferred to review. `lessons.md` added. Next: owner reviews the value brief; then Wave 0 (outside probe, `/status.json`, nightly snapshot, daily routine, hygiene, small fixes).

**Live findings on Nov 7:** 75 of 112 events are Act now and 0 are Low; no top 3 to 5; Exposure and Damage rungs never show on Act now events; share-image font error (19 in 7 days); 4 Act now events with empty "why it matters"; 9 Dependabot PRs open since Oct 24; 9 merged feature branches not deleted.

---

Previous status (Oct 24 to 27) follows.


Updated Oct 24, 2026, evening. The site is live with real data at https://securitythreatpulse.com.

**Phase:** 0 and 1 live. The 7-day unattended freshness clock for the Phase 1 gate started Oct 24. Phase 2 measured twice (first
backtest, then the independent review and the corrected backtest); v2 active.

**On main:**
- Public site: home, event pages, board brief, methodology, about, terms, privacy. Dark default,
  grey option. Sample data until DATABASE_URL is set. Security headers.
- Admin console at /admin: GitHub sign-in (allowlist), audit log, overview, roadmap, sources, runs,
  events (override, hide, rename, merge, narrative editor with optional AI draft), corrections,
  settings.
- Ingest: 14 adapters (all live-tested Oct 24, no failures; VulnCheck needs a token), runner,
  optional R2 archive, event grouping, ladder, cron routes (every 15 min), migrations 0000 and 0001.
- Ladder rule: exploitation lifts the attempts rung to the same state.
- CI, dependency audit, gitleaks, CodeQL, Dependabot.
- Rules v2 and the corrected backtest (branch `feat/rules-fix`): dataset of 5,807 CVEs in four
  strata (Apr 2025 to Oct 2026), replay and scoring with Wilson intervals, held-out gate with a
  reveal log. Headline, population weighted: an Act now given before any confirmation is right
  within 30 days 43% of the time over the window (35 to 53), 35% on the held-out six months
  (21 to 53); 15% of KEV additions get a pre-listing Act now, median lead 4 days. The first
  draft's 60 to 64% was wrong (unweighted, biased population, circular truth, no ingest lag). The
  80% pre-listing target is far from met with public signals alone. v2 asks for two reports or
  honeypot attempts before an early Act now. The live CIRCL adapter now drops KEV catalog mirror
  sightings, matching the replay. Details in `docs/methodology-rules.md`,
  `docs/backtest-review-2026-10-24.md` and `reports/backtest/`.

**Phase 2 surface (branch `feat/phase2-surface`):** /methodology renders `docs/methodology-rules.md` with a
rules changelog; /admin/rules and /admin/scorecard (read only); early events for CVEs with reported
exploitation or confirmed honeypot attempts and no KEV listing (id `early-<cve>`, at most 25 new per
run, needs a known CVE publish date; a KEV listing adopts the early event so its id and history carry on).

**Live setup (Oct 24):** Cloudflare DNS (apex A records and www CNAME, DNS only) points at Vercel.
Neon `stp-db` is connected through the Vercel Marketplace (DATABASE_URL in Production and Preview).
Migrations ran through the protected POST /api/cron/migrate route. First ingest: 28 sources, no
failures (VulnCheck skipped, no token). As of the first evening: 91 events, 67 Act now, 24 Watch.
The cron routes expire the "stp" cache tag after each events sync and after any ingest that adds
observations, so the home page shows new data within one run.

**Home page:** lists Act now events with an attack, exploitation or damage report dated in the last
30 days (30 of 67 on Oct 24), then up to 12 Watch and 6 Low. All events stay on /events.

**Admin sign-in:** AUTH_GITHUB_ID and AUTH_GITHUB_SECRET are set (secret in Production only). The
sign-in reaches GitHub's authorize screen; the owner's first authorize click completes it. Optional keys: VULNCHECK_API_TOKEN, NVD_API_KEY, ANTHROPIC_API_KEY, GITHUB_TOKEN; R2 bucket.
Decisions: the pre-listing accuracy target; attribution for news publishers.

**Owner feedback:** /admin/roadmap has "Feedback for agents". Notes become GitHub issues labeled
`feedback`; every session starts by handling the open ones (see AGENTS.md). GITHUB_TOKEN is set
(fine-grained, this repo only, Issues read and write, expires Oct 2027). Tested end to end with issue #10.

**Health and alerts:** after each ingest run, the health check opens one GitHub issue labeled `alert`
per unhealthy source, for the events cron (`events-sync`) and for database storage at 80% of the
Neon free plan; each closes on recovery. The admin overview shows the same alerts and the database
size (15 MB on Oct 25). The status strip shows DELAYED after an hour without updates. `npm run smoke`
checks the live site after a deploy. No alerts open on Oct 25.

**Report figures on the home page:** each one was checked against its source page on Oct 24 and
links to it with a date (VulnCheck 1H 2026, Bloomberg Law, Verizon DBIR via CXO Digital Pulse,
ReliaQuest, Check Point). Unconfirmed figures were replaced or removed. Tile 1 is computed live.

**Policy:** named-organizations and takedown policy approved Oct 25 and live on /methodology
(`docs/policy-claims-and-takedown.md`).

**Readability (Oct 25):** event titles are plain language built from a fixed keyword and CWE table
(`src/lib/ladder/plain-title.ts`), with the official name shown under the title on event pages.
Lists show the first sentence and a starter question. KEV events show CISA's instruction and
federal deadline as "The fix" when no narrative exists. Phones get a card layout. Admin renames go
to `events.title_override` and survive syncs. The cron routes apply pending migrations first.

**Machine layer (Oct 25):** /api/v1/events and /api/v1/events/{id} (JSON, no key, CORS open),
/events/feed.xml (Act now RSS), /llms.txt and a read-only MCP server at /api/mcp (list_events,
get_event, search_events). Evidence from VulnCheck and from sources with unclear
or unapproved terms (CIRCL today) is withheld from the API and counted as withheld.

**Business readers (Oct 27):** owner direction is one simple "do this" view for small and large
organizations alike. Every event has a plain category with why it matters and a first step
(`src/lib/ladder/category.ts`), plus a fallback for readers without IT staff. "Vendors you use"
filters events in the reader's browser. Clarity panel (5 simulated readers, 3 Act now pages):
11 of 15 before these changes.

**Known gaps:** full plain-English write-ups still need narratives (waiting on the owner:
ANTHROPIC_API_KEY for AI drafts, or hand-written ones). Some early events lack a product name until
NVD fills it in (an NVD_API_KEY speeds that up).

**Polish (branch `feat/polish`):** public /corrections log with RSS, home page noise caps with a paginated /events index,
event freshness dates, accessibility pass, 404 and error pages, robots.txt and sitemap.xml, Open Graph image. The site stays
noindex until `STP_ALLOW_INDEXING=true` is set (see `.env.example`).
