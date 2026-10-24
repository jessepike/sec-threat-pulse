# Status

Updated Oct 24, 2026.

**Phase:** 0 and 1 code complete, waiting on owner setup to go live. Phase 2 measured twice (first
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

**Vercel:** project `security-threat-pulse` (pikeholdings), domain added, CRON_SECRET, AUTH_SECRET,
ADMIN_GITHUB_LOGINS set.

**Waiting on the owner:** Cloudflare DNS records, Neon via Vercel Marketplace, GitHub OAuth app
(AUTH_GITHUB_ID/SECRET), VULNCHECK_API_TOKEN, NVD_API_KEY. Optional: R2 bucket, GITHUB_TOKEN for
the roadmap page, ANTHROPIC_API_KEY for narrative drafts. Decision: the pre-listing accuracy target.

**Next once DATABASE_URL exists:** `npm run db:migrate`, `npm run ingest:seed`, trigger ingest and
events once, check the live pages, start the 7-day freshness clock for the Phase 1 gate.
