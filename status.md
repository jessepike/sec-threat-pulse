# Status

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

**Source health:** after each ingest run, unhealthy sources get one GitHub issue labeled `alert`
(closes on recovery). The status strip shows DELAYED after an hour without updates. None open yet.

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

**Known gaps:** full plain-English write-ups still need narratives (waiting on the owner:
ANTHROPIC_API_KEY for AI drafts, or hand-written ones). Some early events lack a product name until
NVD fills it in (an NVD_API_KEY speeds that up).

**Polish (branch `feat/polish`):** public /corrections log with RSS, home page noise caps with a paginated /events index,
event freshness dates, accessibility pass, 404 and error pages, robots.txt and sitemap.xml, Open Graph image. The site stays
noindex until `STP_ALLOW_INDEXING=true` is set (see `.env.example`).
