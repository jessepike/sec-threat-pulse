# Verdict rules v1 and the backtest behind them

Written Oct 24, 2026 for the Phase 2 gate. This is the draft of the public methodology page. The
numbers come from `reports/backtest/v0-2025-04-01-2026-10-01.json` and
`reports/backtest/v1-2025-04-01-2026-10-01.json`, produced by `npm run backtest`.

## What a verdict means

Every event gets one of three verdicts from a fixed, versioned rule set. The rules read the
evidence ladder and a few facts about the vulnerability. No model opinion is involved.

- **Act now.** Exploitation is confirmed by an authoritative source and something makes it
  urgent, or exploitation is reported for a vulnerability that is 90 days old or newer.
- **Watch.** There is a real signal but it falls short of that bar.
- **Low.** No confirmed or reported attacks and no sign of widespread exploit tools.

## The exact conditions (v1)

The rules run top to bottom. The first match wins.

1. **Exploitation confirmed** (CISA KEV, VulnCheck KEV or a CISA SSVC "active" decision) and at
   least one of: CISA marks ransomware use; the CVE is 365 days old or newer; ready-made attack
   tools exist (a Metasploit module or a nuclei template); the product faces the internet or
   gives remote access; the CVSS base score is 9.0 or higher; the EPSS score is 0.50 or higher.
   Verdict: **Act now**. The reason lists each factor that applied.
2. **Exploitation confirmed** with none of those factors. Verdict: **Watch**. In practice this is
   an old vulnerability added to a catalog long after it was patched.
3. **Exploitation reported** (a news or social report, or a CIRCL sighting from a non catalog
   source) and the CVE is 90 days old or newer. Verdict: **Act now**.
4. **Exploitation reported** for an older CVE. Verdict: **Watch**.
5. **Attack attempts** confirmed or reported (for example Shadowserver honeypot telemetry via
   CIRCL). Verdict: **Watch**.
6. **Damage** confirmed or reported. Verdict: **Watch**.
7. **Ready-made attack tools** exist. Verdict: **Watch**.
8. **Three or more public GitHub repositories** claim proof of concept code. Verdict: **Watch**.
9. **EPSS 0.30 or higher.** Verdict: **Watch**.
10. Otherwise **Low**.

Thresholds live as named constants in `src/lib/ladder/rules/v1.ts`. The rules are monotonic in
the ladder: a higher rung never produces a lower verdict for the same context (tested).

### What changed from v0

- v0 gave Act now to "exploitation reported plus attack tools" at any age. In the backtest that
  rule was right 28% of the time, mostly because years old social posts about old CVEs with old
  Metasploit modules fired on day one. v1 ties reported exploitation to CVE age instead.
- v0 left a third of confirmed KEV additions at Watch because they lacked an amplifier. v1 adds
  two stable amplifiers, "CVE under a year old" and "CVSS 9 or higher", so 97% of KEV additions
  reach Act now and the rest are old catalog back fills.
- v1 adds the proof of concept crowd rule (three or more repositories) at Watch.
- CIRCL "exploited" sightings are now split by source. Shadowserver honeypot feeds become
  confirmed attack attempts. Sightings that mirror a KEV catalog are not counted again.

## The backtest

### Data

Window: Apr 1, 2025 to Oct 1, 2026 (18 months). Outcomes observed through Oct 24, 2026, so every
call before Sep 24, 2026 has its full 30 day follow up. Dataset: `data/backtest/dataset.json.gz`
(5,444 CVEs, 0.3 MB), rebuilt with `npm run backtest:dataset`.

Three strata, sampled with seed 42:

| Stratum | Who | Population | Sampled |
|---|---|---|---|
| kev | Every CVE added to CISA KEV from Apr 1, 2025 to Oct 24, 2026 | 444 | 444 |
| signal | CVEs published in the window, CVSS 7+, never in KEV, with at least one public exploit signal | 13,174 | 3,000 |
| random | CVEs published in the window, CVSS 7+, never in KEV, with no exploit signal | 36,167 | 2,000 |

"Weighted" figures scale each stratum back to its population size.

Point in time signal timelines, all from public sources:

| Signal | Source | How the date is known |
|---|---|---|
| Confirmed exploitation | CISA KEV `dateAdded`; CISA Vulnrichment SSVC `Exploitation: active` | KEV date; first git commit in cisagov/vulnrichment that set the value |
| Reported exploitation and attempts | CIRCL Vulnerability-Lookup sightings (exploited, proof of concept, confirmed) | Sighting creation time; source text classifies honeypot, Telegram, catalog mirror, other |
| Attack tools | Metasploit exploit modules; nuclei templates | First git commit that added the file (history since Mar 5, 2025; older files count as present from the window start) |
| Proof of concept | PoC-in-GitHub repository `created_at`; Exploit-DB `date_published`; SSVC `Exploitation: poc` | As stated |
| Forecast | FIRST EPSS daily bulk files, every day of the window | Published score for that day |
| Facts | CVE List V5 (publish date, CVSS, vendor, product); KEV ransomware flag | CVE record; current KEV flag |

VulnCheck KEV was skipped: no token in the build environment. The builder uses it when
`VULNCHECK_API_TOKEN` is set.

### Method

For every CVE and every day in its window (from publication, or the window start for older
CVEs) the harness rebuilds the observations that were public that day, computes the ladder and
exploit maturity with the production code, applies the rules version, and records each verdict
change. Code: `src/lib/backtest/replay.ts` and `score.ts`, pure functions with unit tests.

Ground truth ("confirmed exploited"): the earliest of a CISA KEV listing, a CISA SSVC "active"
decision, a VulnCheck KEV listing, or two independent non catalog exploitation reports. In this
dataset KEV decided every case. The circularity is real: KEV is both an input and the answer, so
the numbers that matter are the calls made **before** the KEV listing.

Time split: CVEs are assigned to a period by their KEV date, or by their publish date when never
listed. Tuning period Apr 1, 2025 to Mar 31, 2026 (2,313 CVEs). Held out period Apr 1 to Oct 1,
2026 (3,106 CVEs). v1 was designed on the tuning period and judged on the held out period.

Definitions:

- **Act now precision.** Share of CVEs whose first Act now day was followed (or preceded) by
  confirmed exploitation within 30 days. "Before confirmation" counts only calls made before any
  confirmation existed. A 90 day horizon is shown beside it.
- **Low hold.** Share of CVEs with a scoreable Low stretch that saw no confirmation within 30
  days of any Low day.
- **Lead time.** KEV date minus first Act now day, for KEV additions inside the period.
- **Coverage.** Share of KEV additions that were Act now on the listing day, and ever.

### Results

| Metric | Target | v0 tuning | v0 held out | v1 tuning | v1 held out |
|---|---|---|---|---|---|
| Act now precision, all calls | 80%+ | 87.7% (150/171) | 89.6% (103/115) | 90.4% (225/249) | 90.3% (158/175) |
| Act now precision, calls before confirmation, 30 days | 80%+ | 27.6% (8/29) | 29.4% (5/17) | 64.2% (43/67) | 60.5% (26/43) |
| Same calls, 90 day horizon | | 52.0% | 41.7% | 73.1% | 75.0% (18/24) |
| Act now precision weighted to population, all calls | | 74.1% | 87.0% | 75.9% | 77.3% |
| Low hold, 30 days, sampled | 90%+ | 94.6% | 96.6% | 94.7% | 96.7% |
| Low hold, weighted to population | 90%+ | 99.4% | 99.7% | 99.4% | 99.7% |
| KEV additions called Act now before listing | | 11.9% (29/243) | 10.8% (19/176) | 24.7% (60/243) | 19.3% (34/176) |
| Median lead of those calls (days) | 2+ | 53 | 49 | 4.5 | 4.5 |
| Median lead, all Act now calls on KEV additions (days) | 2+ | 0 | 0 | 0 | 0 |
| KEV additions Act now ever / on listing day | | 65% / 44% | 67% / 50% | 97% / 91% | 97% / 94% |
| Watch calls confirmed within 90 days | | 41.1% | 41.3% | 40.4% | 40.0% |
| Verdict downgrades (all CVEs in period) | | 53 | 14 | 83 | 14 |

Lead time detail for v1, all 94 pre listing calls: 25th percentile 2 days, median 5, 75th
percentile 25; 77 of 94 were at least 2 days ahead and 36 at least 7 days ahead. The v0 median of
about 50 days is an artifact: its pre listing calls were mostly old CVEs that fired on the first
day of the window from signals that were years old.

Confusion for v1 (peak verdict before confirmation against the outcome, whole window): of 425
CVEs confirmed exploited, 90 had reached Act now, 120 Watch, 123 Low, and 92 had no day before
confirmation at all (listed on their publish day). Of 4,994 never confirmed, 24 reached Act now,
155 Watch and 4,815 stayed Low.

### Reading the results honestly

- The targets are met for Act now precision over all calls and for Low hold. They are not met
  for calls made before the KEV listing: v1 reaches about 60 to 64% at 30 days and about 75% at
  90 days. The held out period agrees with the tuning period, so this is the real rate of the
  rule, not overfitting.
- Lead time is 2+ days for the calls that are made before listing (median 4.5 days), but only
  about a fifth of KEV additions get such a call. Over all KEV additions the median lead is zero:
  most are Act now on the listing day. 22% of KEV additions were listed on the day the CVE was
  published, so no public signal could have led them.
- The weighted figures are lower because the signal stratum is large: in the whole population,
  a pre listing Act now is right about 38% of the time at 30 days. We publish both.
- No single public signal predicts a KEV listing within 30 days at 80%. In the tuning period the
  best were: an exploitation report on a CVE under 90 days old (69%), the same within 14 days of
  the report (70%), weaponized tools on an edge product (67%, six cases), three or more PoC
  repositories on a CVE under 30 days old (43%), Metasploit module on a new CVE (24%), nuclei
  template (20%), honeypot attempts (16%), EPSS 0.5 or higher (7%). High EPSS alone is a poor
  predictor of a KEV listing: many high EPSS CVEs are attacked at scale and never listed.
- Many "false" pre listing calls look right on inspection: Erlang/OTP SSH (CVE-2025-32433),
  Craft CMS (CVE-2025-32432), Roundcube (CVE-2025-49113), n8n (CVE-2025-68613) and Sudo
  (CVE-2025-32463) were all reported exploited early and listed later than 30 days after. Others
  (for example a Linksys E4200 bug with a Metasploit module and honeypot hits) were likely
  exploited and never listed. KEV is a conservative ground truth.
- The Low hold on the KEV stratum alone is 13%: most KEV additions had no public pre signal and
  were Low until the listing day. That is a fact about public data, and the reason the site
  shows "no evidence" rather than guessing.

### Known limits

- KEV is both input and ground truth. The "two independent reports" path exists in code but
  decided no case here, because CIRCL is the only report source in the dataset so far.
- The KEV ransomware flag is read as it stands today, not as of the listing day.
- Metasploit and nuclei dates come from git history since Mar 5, 2025. Older files are treated as
  present from the window start; a few may have been added between March 5 and April 1.
- Telegram sightings in CIRCL are social posts, classed as reported exploitation. They are the
  main pre listing signal and also the main source of false pre listing calls.
- EPSS scores are rounded to three decimals and stored as change points.
- The live site only creates events on a KEV listing today (Phase 1 grouping). Pre listing Act
  now calls need events to exist earlier; that is Phase 3 work. Live KEV additions also start
  without a publish date until the CVE List adapter enriches them (within about an hour), so a
  fresh listing can show Watch for that hour and then move to Act now.
- Sightings of type "confirmed" from CIRCL are counted as proof of concept, not exploitation,
  as in the live adapter.

## Rebuilding

```
npm ci
npm run backtest:dataset -- --from 2025-04-01 --to 2026-10-01     # about 10 minutes with a warm cache
npm run backtest -- --rules v1 --from 2025-04-01 --to 2026-10-01 --errors 20
```

The builder caches everything under `.cache/backtest/` (gitignored): the KEV catalog, daily EPSS
files (about 580 files, 1.3 GB), a sparse clone of cvelistV5 for 2025 and 2026 (1.5 GB), shallow
clones of vulnrichment, metasploit-framework and nuclei-templates since Mar 1, 2025, a depth one
clone of PoC-in-GitHub, and the CIRCL sighting pages (one request every 3.5 seconds, 151 pages).
A cold build takes 30 to 60 minutes, mostly network. Every request sends the STP User-Agent.
The dataset is committed when it is under 20 MB; otherwise it stays in the cache and this
document tells you how to rebuild it.
