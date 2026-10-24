# Status

Updated Oct 24, 2026.

**Phase:** 0 and 1 code complete, waiting on owner setup to go live. Phase 2 in progress.

**On main:**
- Public site: home, event pages, board brief, methodology, about, terms, privacy. Dark default,
  grey option. Sample data until DATABASE_URL is set. Security headers.
- Admin console at /admin: GitHub sign-in (allowlist), audit log, overview, roadmap, sources, runs,
  events (override, hide, rename, merge), corrections, settings.
- Ingest: 14 adapters (all live-tested Oct 24, no failures; VulnCheck needs a token), runner,
  optional R2 archive, event grouping, ladder, rules v0, cron routes (every 15 min), migration.
- Ladder rule: exploitation lifts the attempts rung to the same state.

**Vercel:** project `security-threat-pulse` (pikeholdings), domain added, CRON_SECRET, AUTH_SECRET,
ADMIN_GITHUB_LOGINS set.

**In flight:** verdict rules v1 + backtest (feat/rules); event narratives, AI drafts, CI and
security workflows (feat/narrative).

**Waiting on the owner:** Cloudflare DNS records, Neon via Vercel Marketplace, GitHub OAuth app
(AUTH_GITHUB_ID/SECRET), VULNCHECK_API_TOKEN, NVD_API_KEY. Optional: R2 bucket, GITHUB_TOKEN for
the roadmap page, ANTHROPIC_API_KEY for narrative drafts.

**Next once DATABASE_URL exists:** `npx drizzle-kit migrate`, `npm run ingest:seed`, trigger
ingest and events once, check the live pages, start the 7-day freshness clock for the Phase 1 gate.
