# Status

Updated Oct 24, 2026.

**Phase:** 0 and 1 code complete, waiting on owner setup to go live. Phase 2 measured; v1 active.

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
- Rules v1 and backtest: dataset of 5,444 CVEs (Apr 2025 to Oct 2026), replay and scoring harness.
  Act now precision over all calls 90%, Low hold 99.6% weighted. Calls made before a KEV listing
  are right 60 to 64% at 30 days (75% at 90 days), median lead 4.5 days, a fifth of KEV additions
  get such a call. The 80% pre-listing target is not met with public signals alone. Details in
  `docs/methodology-rules.md` and `reports/backtest/`.

**Vercel:** project `security-threat-pulse` (pikeholdings), domain added, CRON_SECRET, AUTH_SECRET,
ADMIN_GITHUB_LOGINS set.

**Waiting on the owner:** Cloudflare DNS records, Neon via Vercel Marketplace, GitHub OAuth app
(AUTH_GITHUB_ID/SECRET), VULNCHECK_API_TOKEN, NVD_API_KEY. Optional: R2 bucket, GITHUB_TOKEN for
the roadmap page, ANTHROPIC_API_KEY for narrative drafts. Decision: the pre-listing accuracy target.

**Next once DATABASE_URL exists:** `npm run db:migrate`, `npm run ingest:seed`, trigger ingest and
events once, check the live pages, start the 7-day freshness clock for the Phase 1 gate.
