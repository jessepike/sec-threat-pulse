# Independent backtest review, Oct 24, 2026

Reviewer: separate model, no access to the builder's reasoning. Reproduced v1 numbers exactly from
the committed dataset. Replay code correct (3 hand-traced CVEs). Findings, ranked:

1. MATERIAL. Headline rates are unweighted; the sample is mostly KEV (kev 100%, signal 23%,
   random 5.5%). Weighted: pre-confirmation Act now 37.6% / 38.2% (tuning / held-out), not
   64.2% / 60.5%. Watch confirmed in 90 days 17.4%, not 40%. Act now all calls 76.5%, below the
   80% target the doc calls met.
2. MATERIAL. Population inconsistent: kev stratum takes any CVSS and any publish year
   (build-dataset.ts:466); non-KEV strata take only in-window CVSS>=7 (build-dataset.ts:469).
   About 105 never-KEV CVEs that would have fired a pre-confirmation Act now are excluded
   (95 in-window CVSS<7, 10 pre-window). Including them: weighted pre-confirmation about 24%,
   weighted all-calls about 63%.
3. MATERIAL. Backtest drops CIRCL "kev-catalog" sightings (replay.ts circlObservation) but the
   live adapter maps them to reported exploitation (circl-sightings.ts:45-51). Those catalogs
   are bulk imports (346 CVEs on 2026-06-19), not CISA. With production mapping: held-out
   pre-confirmation 53.4%, weighted 26.3%.
4. MATERIAL (framing). Act now all-calls: 314 of 424 calls came on or after confirmation and
   count as hits by construction. Low hold: an always-Low rule scores 92.0% sampled, 99.1%
   weighted, so the 90% target is met by construction. Informative: Low hold on the KEV
   stratum (13%) and pre-confirmation precision. Coverage 97% follows from rule design.
5. MATERIAL (moderate). Doc says KEV decided every case: false. cisa-kev 404, two-reports 41,
   SSVC active 5. Two-reports counts Shadowserver honeypot hits as an independent exploitation
   report while the same hits are attack attempts; the same CIRCL feed both triggers and
   confirms (e.g. CVE-2026-41089). With KEV+SSVC truth: held-out 55.8% (24/43), weighted 31.2%.
6. CIRCL timestamps can be backfilled. A 1-day lag (also a fair model of live ingest latency):
   pre-confirmation 62.7% -> 56.8%, pre-listing calls 94 -> 79; 17 of 94 leads are 1 day.
   Other suspects (ransomware flag, CVSS, vendor/product, tool dates, SSVC, EPSS) move v1
   numbers by about a point or less. v0 is sensitive to tool dates, so v0 vs v1 is soft.
   SSVC "active" is effectively KEV again, not independent.
7. Periods assigned by outcome (KEV date) for KEV CVEs. Samples small: held-out 26/43 has a 95%
   CI of about 46% to 74%; 90-day 18/24 about 55% to 88%.
8. Tuning vs held-out discipline cannot be audited from git (commits within one second).
   run.ts always prints held-out results. Single-signal study figures have no script.
9. Minor: 4 calls on the window start from pre-window signals; median lead 5 vs 4.5 typo;
   v1 reason "Reports this early are usually confirmed within days" (v1.ts:57) contradicted by
   the data; Telegram sightings include keyword noise (e.g. CVE-2025-33071 on a Patch Tuesday
   summary naming a different CVE).

Judgment: do not publish the methodology headline numbers as written.
