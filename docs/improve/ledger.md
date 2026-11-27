# Improve loop ledger

One row per run, newest first, kept or not. `docs/improve/program.md` says how a row is written.
Reviewers: C = Codex, S = Claude on sonnet, O = Claude on opus (adversarial), G = Gemini; a = approve, r = reject.

| Date | Item | Target metric | Before | After | Result | Reviewers | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-27 | None: nothing in the coverage lane scored above 0.5. Recheck of #60 (`cisa-ics`): gain holds | live.sourcesOk (recheck) | 30 | 30 | none | not run (no change) | |
| 2026-11-25 | None: nothing in the coverage lane scored above 0.5 | none | | | none | not run (no change) | |
| 2026-11-23 | None: nothing in the coverage lane scored above 0.5 | none | | | none | not run (no change) | |
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

Nov 23, run 2. Gates clear (no PAUSE, no alert issue, no open improve pull request); live scorecard
from the Nov 23 16:13 UTC snapshot. `live.sourcesOk` is already 30, so the Nov 20 gain holds ahead
of its Nov 27 recheck. No kept rows are 6 to 8 days old. Nothing shipped, because no candidate
scored above 0.5. ENISA EUVD and the Palo Alto Networks, Fortinet and Cisco advisory feeds are
still refused by the build container's network (rechecked today, along with cisa.gov), so no
fixture test can be written for them; this blocks every keyless source not hosted on GitHub. The
`cisa-ics` stuck document guard scores about 0.2: all 68 documents changed in the last 30 days
parse cleanly today, so the failure it guards against has not happened. Collapsing a repeated
advisory in the evidence list (31 of those 68 documents name more than one CVE) is UX lane work
and moves no coverage metric. Both stay in `ideas.md`.

Nov 25, run 3. Gates clear (no PAUSE, no alert issue, no open improve pull request); live scorecard
from the Nov 25 15:49 UTC snapshot, unchanged from Nov 23 (`live.sourcesOk` 30, `repo.keylessSources`
30, `live.earlyActNowShare` 0). No kept rows are 6 to 8 days old; the CISA ICS recheck is Nov 27.
Nothing shipped. The hosts parked for the owner (ENISA, Palo Alto Networks, Fortinet, Cisco,
cisa.gov) and two new ones tried today (MSRC's API, Ivanti) are still refused by the build
container. Google Project Zero's in-the-wild list (a Google Sheet) and inthewild.io are refused too.
New candidate found: GitHub security advisories through OSV's public bucket on Google Cloud Storage,
which the container can reach. Each ecosystem's `modified_id.csv` is sorted newest first and
answers a Range request, so one small read lists the latest records, and each record
(`<ecosystem>/<id>.json`) names its CVE aliases. It scores about 0.4: it would add one keyless source
(30 to 31) and an independent Talk source for open source CVEs, but no verdict rule reads Talk,
so it moves no accuracy or lead time metric. Parked in `ideas.md` as build ready.

Nov 27, run 4. Gates clear (no PAUSE, no alert issue, no open improve pull request); live scorecard
from the Nov 27 15:21 UTC snapshot, unchanged from Nov 25 (`live.sourcesOk` 30, `repo.keylessSources`
30, `live.earlyActNowShare` 0). Recheck of the Nov 20 kept row (#60): `cisa-ics` is `ok` in the live
snapshot and `live.sourcesOk` holds at 30, so the gain stands and nothing is reverted. Nothing
shipped. The seven parked hosts (ENISA, Palo Alto Networks, Fortinet, Cisco, cisa.gov, MSRC, Ivanti)
are still refused by the build container. GHSA through OSV still scores about 0.4. This is the third
`none` in a row: the coverage lane is blocked until the owner allows those hosts or changes the lane.
