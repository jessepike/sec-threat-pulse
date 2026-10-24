# Status

Updated Oct 24, 2026.

**Phase:** 0 (Foundations), Phase 1 in flight, Phase 2 measured.

**Done:** repo scaffolded (Next.js 16, Drizzle, Auth.js), data model and ladder types, agent docs,
source registry, design prototypes in `docs/design/`.

**In flight:** ingest adapters (P1 sources), public site port of the prototypes, admin console.

**Waiting on the owner (one-time setup):** Vercel project link, Neon database, DNS records in
Cloudflare, GitHub OAuth app for admin sign-in, VulnCheck token, NVD key, R2 bucket.

**Phase 2 (branch `feat/rules`):** backtest dataset (5,444 CVEs, Apr 2025 to Oct 2026), replay and
scoring harness, rules v1 designed from the evidence and switched on. Results and limits in
`docs/methodology-rules.md` and `reports/backtest/`. Short version: Act now precision over all
calls 90%, Low hold 99.6% weighted, but calls made before a KEV listing are right only 60 to 64%
of the time at 30 days (75% at 90 days) with a median lead of 4.5 days, and only a fifth of KEV
additions get such a call. The 80% pre listing target is not met with public signals alone.

**Next:** deploy to Vercel preview, run migrations on Neon, turn on cron; merge `feat/rules`.
