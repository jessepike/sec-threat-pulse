# Improve loop ideas

Candidates the loop scores at step 4 of `docs/improve/program.md`. Add ideas freely; the loop adds
its own and parks what needs the owner. Lane, then the metric it should move.

## Coverage (active lane)

- ENISA EUVD as a keyless source: EU vulnerability records and its exploited list. `repo.keylessSources`, then `live.sourcesOk`; check its reuse terms first. The cloud container cannot reach euvdservices.enisa.europa.eu (proxy 403, Nov 16), so a fixture has to come another way.
- CISA ICS advisories as a keyless source: industrial products leaders buy. `repo.keylessSources`, `live.earlyActNowShare`. Built in dry run 1 (Nov 16) from CISA's CSAF repository on GitHub, rechecked against main in dry run 2 (Nov 18); ship it in the first real run from `/mnt/project-files/improve/2026-11-16-cisa-ics-advisories.patch`.
- Vendor PSIRT feeds for the most bought vendors (Cisco, Fortinet, Palo Alto Networks, Ivanti), the MSRC pattern: vendor confirmed exploitation as a second exploitation report. `live.earlyActNowShare`, later `bt.kevCalledBeforeShare` once the dataset is rebuilt with them.
- A second exploitation report source so two independent reports can confirm without KEV (BACKLOG Phase 2). `live.earlyActNowShare`.

## Accuracy (next lane)

- Rebuild the backtest dataset with MSRC and any new vendor source, then study single signals again (`scripts/backtest/signal-study.ts`). Tier 2, then the rules tier.

## UX (later)

- Lighthouse at 390px and 1440px in the scorecard (accessibility, performance, SEO), free npm package. Tier 2: it changes the scorecard.
- Blind clarity score: a fresh session scores the home page against the 15-point rubric weekly.

## Growth (later, needs the owner)

- Traffic numbers would need Vercel Web Analytics, which may cost money. Parked for the owner.

## Parked for the owner

- Install Gemini Code Assist on the repo as a fourth reviewer (owner's click, check the free tier first).
