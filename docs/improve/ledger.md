# Improve loop ledger

One row per run, newest first, kept or not. `docs/improve/program.md` says how a row is written.
Reviewers: C = Codex, S = Claude on sonnet, O = Claude on opus (adversarial), G = Gemini; a = approve, r = reject.

| Date | Item | Target metric | Before | After | Result | Reviewers | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-20 | CISA ICS advisories as a keyless source (`cisa-ics`), tier 2 | repo.keylessSources (live.sourcesOk at the 7 day recheck, Nov 27) | 29 | 30 | kept | C a (after a P2 fix), S r then a, O a | #60 |
| 2026-11-18 | CISA ICS advisories, rechecked against main | repo.keylessSources | 29 | 30 | dry: would keep | not run (dry) | |
| 2026-11-16 | CISA ICS advisories as a keyless source (`cisa-ics`), tier 2 | repo.keylessSources (live.sourcesOk at the 7 day recheck) | 29 | 30 | dry: would keep | not run (dry) | |
| 2026-11-14 | Baseline scorecard (the loop's build, not a run) | none | | | baseline | | |

Baseline, rules v3, backtest tuning period 2025-04-01 to 2026-03-31 (3,094 CVEs), no live numbers yet:
early Act now right within 30 days 0.4634 · KEV additions called before listing 0.1934 · median lead
4 days · Watch confirmed within 90 days 0.1036 · Low hold, KEV stratum 0.2126 · Act now on KEV listing
day 0.9053 · verdict changes per CVE 1.185 · sources 30 (29 keyless) · untracked rungs 2.

Nov 16 dry run 1. Would ship: a `cisa-ics` adapter reading CISA's CSAF repository on GitHub (its
`changes.csv`, then each document changed in 30 days, at most 25 a run), one `advisory` observation
per advisory that names CVEs, linking to CISA's page; vendor roll-ups over 50 CVEs skipped; no
vulnerability facts written. 250 counted lines, tier 2 (new adapter, registry). Tests 465 of 465,
lint and typecheck clean, `keep.mjs` KEEP on `repo.keylessSources` (29 to 30, repo.sources 30 to 31)
and on `--target none`; no backtest metric moved. Why this over ENISA EUVD and vendor PSIRTs: it is
public domain, needs no terms check, and GitHub is reachable from both Vercel and the build
container, while cisa.gov and ENISA are refused by the container's proxy, so no fixture could be
recorded for them. The build is saved as a patch for the first real run.

Nov 18 dry run 2. Gates clear (no PAUSE, no alert issue, no open improve pull request); live
scorecard from the Nov 18 14:20 UTC snapshot, no kept rows to recheck. Pick: CISA ICS advisories
again. Nothing else in the coverage lane comes close: it is built, keyless and public domain, while
ENISA EUVD and the vendor PSIRT feeds still cannot be reached from the build container for a
fixture. Would ship: the Nov 16 build, unchanged. The saved patch applies cleanly to main at
`924c224`; tests 465 of 465, lint and typecheck clean; `keep.mjs` KEEP on `repo.keylessSources`
(29 to 30) and on `--target none`; tier 2 (`src/lib/ingest/registry.ts`, `docs/source-registry.md`).
CISA's `changes.csv` still has the same two-column format and listed 11 new advisories on Nov 17.
Real runs start next run with this item.

Nov 20, first real run. Gates clear; live scorecard from the Nov 20 14:10 UTC snapshot; no kept rows
to recheck. Shipped CISA ICS advisories (#60, squash `16ded3b`). The panel changed the build twice:
Codex (P2) found that a revised advisory reused its dedupe key, so CVEs it added were dropped, and the
sonnet reviewer rejected because one failing document failed the whole run and froze the cursor.
Fixed: one observation per CVE (`cisa-ics:<advisory>:<cve>`), and per-document failure handling
(a failed document is retried next run without the ETag, a 404 is marked read, the run fails only
when every document fails). Tests 468 of 468, lint and typecheck clean, `keep.mjs` KEEP on
`repo.keylessSources` (29 to 30) and `--target none`; no backtest or live metric moved. The opus
reviewer reran everything and read 87 live documents (248 observations, 0 failures, 304 on rerun).
Recheck `live.sourcesOk` (29 now, expect 30) on Nov 27.
