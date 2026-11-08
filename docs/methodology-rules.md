# Verdict rules v2 and the backtest behind them

Written Oct 24, 2026. An independent review of our first backtest found that its figures were
overstated. Every figure on this page comes from the corrected run.



## The short version

- An **Act now** verdict given before any authority confirmed exploitation turned out right, within
  30 days, **about 43% of the time** over the whole 18 month window (95% interval 35% to 53%,
  weighted to the population of CVEs). On the six months the rules were not tuned on it was 35%
  (21% to 53%). Within 90 days the whole window figure is 53%.
- Act now verdicts given **on or after** a CISA KEV listing are right by definition. Counting them,
  precision over all Act now calls is 86%. That figure is mostly construction and we do not lead
  with it.
- A **Watch** verdict was followed by confirmed exploitation within 90 days about 9% of the time.
  Watch means "a real signal, usually nothing more".
- A **Low** verdict held for 30 days 99.8% of the time across the population, but a rule that said
  Low to everything would score 99.6%, because almost no CVE is ever confirmed exploited. The
  informative figure is the KEV stratum: of CVEs that CISA later listed, those the rules still had
  at Low held (no listing within 30 days) 13% of the time. Most KEV additions have no public
  signal before the listing.
- 15% of KEV additions had an Act now before the listing day. For those, the median lead was 4
  days (quartiles 2 and 27). Across all KEV additions the median lead is zero: the usual case is
  Act now on the listing day.

The old draft of this page said early Act now calls were right 60 to 64% of the time. That number
was wrong for the reasons in "Method", "What changed from v1" and "Reading the results honestly" below.

## What a verdict means

Every event gets one of three verdicts from a fixed, versioned rule set. The rules read the
evidence ladder and a few facts about the vulnerability. No model opinion is involved.

- **Act now.** Exploitation is confirmed by an authoritative source and something makes it
  urgent, or exploitation of a vulnerability 90 days old or newer is reported by two separate
  sources, or by one source with attack attempts seen by honeypots.
- **Watch.** There is a real signal but it falls short of that bar.
- **Low.** No confirmed or reported attacks and no sign of widespread exploit tools.

## The exact conditions (v2)

The rules run top to bottom. The first match wins.

1. **Exploitation confirmed** (CISA KEV, VulnCheck KEV or a CISA SSVC "active" decision) and at
   least one of: CISA marks ransomware use; the CVE is 365 days old or newer; ready-made attack
   tools exist (a Metasploit module or a nuclei template); the product faces the internet or
   gives remote access; the CVSS base score is 9.0 or higher; the EPSS score is 0.50 or higher.
   Verdict: **Act now**. The reason lists each factor that applied.
2. **Exploitation confirmed** with none of those factors. Verdict: **Watch**. In practice this is
   an old vulnerability added to a catalog long after it was patched.
3. **Exploitation reported** for a CVE 90 days old or newer, by **two or more separate reports**
   (two CIRCL sightings, two news items, or a mix), **or by one report with confirmed attack
   attempts** (Shadowserver honeypot telemetry). Verdict: **Act now**.
4. **Exploitation reported once** for a CVE 90 days old or newer, with no attempts seen. Verdict:
   **Watch**. The reason says the site is waiting for a second report.
5. **Exploitation reported** for an older CVE. Verdict: **Watch**.
6. **Attack attempts** confirmed or reported. Verdict: **Watch**.
7. **Damage** confirmed or reported. Verdict: **Watch**.
8. **Ready-made attack tools** exist. Verdict: **Watch**.
9. **Three or more public GitHub repositories** claim proof of concept code. Verdict: **Watch**.
10. **EPSS 0.30 or higher.** Verdict: **Watch**.
11. Otherwise **Low**.

Thresholds are named constants in `src/lib/ladder/rules/v2.ts`. The rules are monotonic in the
ladder: a higher rung never produces a lower verdict for the same context (tested). Every result
carries a rule id.

### What changed from v1

Only rules 3 and 4. v1 gave Act now to any single report of exploitation on a new CVE. On the
tuning period a single report was followed by a KEV listing within 30 days 7 times in 165. Two or
more reports were followed by a listing about half the time. The review also found keyword noise
in single Telegram posts (a post about one CVE tagged with another). v2 asks for a second report
or for honeypot attempts. On the tuning period this kept every one of v1's 38 correct early calls
and removed 150 of its 194 wrong ones.

Other options were tried on the tuning period and rejected: asking for a proof of concept, attack
tools or EPSS beside the report made precision worse, because those signals are common on the
wrong calls too; asking for three reports lost correct calls; shortening the 90 day age limit
changed little.

v1's reason text for rule 3 said "Reports this early are usually confirmed within days". The data
contradict that. v1 is frozen so the backtest can replay it, so the correction lives in a wording
map (`src/lib/ladder/rules/reasons.ts`) applied when a v1 result is shown to a reader. v2 writes
honest wording directly.

### What changed from v0

v0 gave Act now to "exploitation reported plus attack tools" at any age and left a third of KEV
additions at Watch. v1 tied reported exploitation to CVE age and added two amplifiers for
confirmed exploitation ("CVE under a year old" and "CVSS 9 or higher"), which lifted the share of
KEV additions that reach Act now from 65% to 97%.

## The backtest

### Data

Window: Apr 1, 2025 to Oct 1, 2026 (18 months). Outcomes observed through Oct 24, 2026, so every
call before Sep 24, 2026 has its full 30 day follow up. Dataset: `data/backtest/dataset.json.gz`
(5,807 CVEs, 0.3 MB), rebuilt with `npm run backtest:dataset`.

Four strata, sampled with seed 42. "Weighted" figures scale each stratum back to its population.

| Stratum | Who | Population | Sampled |
|---|---|---|---|
| kev | Every CVE added to CISA KEV from Apr 1, 2025 to Oct 24, 2026, any CVSS, any publish year | 444 | 444 |
| reported | Never-KEV CVE records with a 2025 or 2026 id, published by Oct 1, 2026, any CVSS, with at least one CIRCL exploitation report from a Telegram or other non catalog, non honeypot source | 363 | 363 |
| signal | Same universe, no such report, but some other public exploit signal | 30,461 | 3,000 |
| random | Same universe, no public exploit signal | 78,119 | 2,000 |

Under v1 and v2 a never-KEV CVE can reach Act now before confirmation only through the reported
stratum, and that stratum is fully enumerated. So the headline precision carries almost no
sampling noise from the never-KEV side; the intervals mostly reflect the small number of calls.

Point in time signal timelines, all from public sources:

| Signal | Source | How the date is known |
|---|---|---|
| Confirmed exploitation | CISA KEV `dateAdded`; CISA Vulnrichment SSVC `Exploitation: active` | KEV date; first git commit in cisagov/vulnrichment that set the value |
| Reported exploitation and attempts | CIRCL Vulnerability-Lookup sightings (exploited, proof of concept, confirmed) | Sighting creation time plus one day (see below); source text classifies honeypot, Telegram, catalog mirror, other |
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
change. CIRCL sightings go through the live adapter's own mapping function, and a test checks the
two paths agree on recorded fixtures. Code: `src/lib/backtest/replay.ts` and `score.ts`, pure
functions with unit tests.

**CIRCL lag.** A sighting is seen one day after its creation timestamp. The live site polls
hourly, so most sightings arrive the same day or the next, and CIRCL backfills some sightings
with earlier timestamps. The zero lag figure is shown in the sensitivity table as the optimistic
bound.

**Ground truth.** A CVE counts as confirmed exploited on the earliest of: CISA KEV listing,
VulnCheck KEV listing (when present), vendor confirmed exploitation (field reserved, not yet
collected). In this dataset that means CISA KEV decided every case. A CISA SSVC "active"
decision is an input to the ladder but not ground truth: in this data it is the KEV decision seen
through another feed. Honeypot hits are attack attempts and never confirm exploitation. The first
draft also accepted "two independent reports" as confirmation; that let the CIRCL feed both
trigger a call and confirm it, so it is gone from the default and shown separately below.

**Periods.** Tuning period Apr 1, 2025 to Mar 31, 2026; held out period Apr 1 to Oct 1, 2026.
Every call is placed in a period by the day it was made. v2 was designed on the tuning period with
held out results hidden (the CLI hides them unless `--reveal-heldout` is passed and logs every
reveal to `reports/backtest/heldout-reveals.log`). v2 was revealed once, on Oct 24, 2026 at
21:05 UTC, and the log shows it.

**Left censoring.** A CVE published before the window that already stood above Low on the first
replayed day has an unknown real call day. Those first day calls (11 for v2) are counted and not
scored.

Definitions:

- **Act now precision, before confirmation.** Of first Act now days that came before any
  confirmation existed, the share followed by confirmation within 30 days (and, separately, 90).
- **Act now precision, all calls.** The same including calls made on or after confirmation. Those
  are hits by construction, so this is a secondary figure.
- **Watch confirmed within 90 days.** Of first Watch or higher days before confirmation, the share
  followed by confirmation within 90 days.
- **Low hold.** Of CVEs with Low days in the period, the share with no confirmation within 30 days
  of any of them. Shown beside the same measure for a rule that says Low to everything.
- **Pre listing share and lead.** Of KEV additions in the period, the share with an Act now before
  the listing day, and the lead in days for those.
- **Coverage.** Share of KEV additions that were Act now on the listing day, and ever. Follows
  from rule 1, so secondary.

Intervals are 95% Wilson score intervals. For weighted rates the interval uses the Kish effective
sample size, which is an approximation.

### Results

Population weighted, 95% interval in brackets, then sampled hits over calls.

| Metric | v2 tuning | v2 held out | v2 whole window | v1 whole window | v0 whole window |
|---|---|---|---|---|---|
| Act now before confirmation, right within 30 days | 46.3% (36 to 57); 38/82 | 35.5% (21 to 53); 11/31 | 43.4% (35 to 53); 49/113 | 17.8% (14 to 22); 58/325 | 15.8% (10 to 24); 16/101 |
| Same calls, 90 day horizon | 56.1% (45 to 66); 46/82 | 30.8% (13 to 58); 4/13 | 52.6% (43 to 62); 50/95 | 21.4% (17 to 27); 58/271 | 31.0% (21 to 42); 22/71 |
| Watch confirmed within 90 days | 10.4% (6 to 18); 75/329 | 6.3% (2 to 17); 27/116 | 8.9% (5 to 15); 102/445 | 8.9% (5 to 15); 102/445 | 9.0% (5 to 15); 97/424 |
| Low hold, KEV stratum, 30 days | 21.3% (16 to 28); 37/174 | 7.5% (4 to 14); 8/107 | 12.9% (9 to 18); 34/263 | 12.9% (9 to 18); 34/263 | |
| Always Low baseline, KEV stratum | 10.2% (7 to 14); 30/295 | 0.0% (0 to 1); 0/424 | 0.0% (0 to 1); 0/424 | same | same |
| Low hold, weighted, 30 days | 99.7% (99 to 100) | 99.9% (100 to 100) | 99.8% (100 to 100) | 99.8% | |
| Always Low baseline, weighted | 99.5% (99 to 100) | 99.6% (99 to 100) | 99.6% (99 to 100) | same | same |
| KEV additions with an Act now before listing | 19.3% (15 to 25); 47/243 | 9.1% (6 to 14); 16/176 | 15.0% (12 to 19); 63/419 | 18.9% (15 to 23); 79/419 | 10.5% (8 to 14); 44/419 |
| Median lead of those calls (quartiles) | 4 days (2, 27) | 4 days (2, 20) | 4 days (2, 27) | 5 days (3, 34) | 58.5 days (5, 276) |

Secondary, partly true by construction:

| Metric | v2 tuning | v2 held out | v2 whole window | v1 whole window | v0 whole window |
|---|---|---|---|---|---|
| Act now precision, all calls | 83.6% (79 to 88); 225/269 | 88.8% (83 to 93); 159/179 | 85.7% (82 to 89); 384/448 | 58.6% (55 to 62); 378/645 | 74.2% (69 to 79); 244/329 |
| Of which calls on or after confirmation | 187 | 148 | 335 | 320 | |
| KEV additions Act now on listing day | 90.5% | 94.3% | 92.1% | 92.1% | 46.5% |
| KEV additions Act now ever | 96.7% | 97.2% | 96.9% | 96.9% | |

Reading the Low hold rows: the KEV stratum baseline is near zero in the held out period because
by then every CVE in that stratum had been listed, so a Low verdict on any of them in that period
is a miss by definition. The rules' 7.5% over the same CVEs says the rules had already moved most
of them above Low. The weighted Low hold is only 0.2 points above its baseline: the population is
dominated by CVEs nothing ever happens to, and Low hold measured on it says almost nothing about
the rules.

### Sensitivity

Act now before confirmation, 30 days, v2, weighted with intervals. The default column is the
headline. `scripts/backtest/sensitivity.ts` reproduces the table.

| Period | Default | CIRCL lag 0 | Truth also counts two CIRCL reports | Old production mapping (catalog mirrors counted) |
|---|---|---|---|---|
| Tuning | 46.3% (36 to 57); 38/82 | 53.2% (43 to 63); 50/94 | 53.3% (42 to 64); 40/75 | 46.3%; 38/82 |
| Held out | 35.5% (21 to 53); 11/31 | 44.4% (30 to 60); 16/36 | 35.7% (21 to 54); 10/28 | 22.4% (10 to 44); 16/53 |
| Whole window | 43.4% (35 to 53); 49/113 | 50.8% (42 to 59); 66/130 | 48.5% (39 to 58); 50/103 | 35.2% (25 to 47); 54/135 |

The last column matters for operations: before Oct 24 the live CIRCL adapter kept catalog mirror
sightings as reported exploitation. Under v2 those mirrors would have counted as second reports
and cut held out precision to 22%. The adapter now drops them, the same as the replay, and a
parity test guards it.

### Single signals

`scripts/backtest/signal-study.ts` reproduces this table: for each signal, the first day it held
before any confirmation, and the share followed by a confirmation within 30 days. Whole window,
weighted, with intervals.

| Signal | Share confirmed within 30 days |
|---|---|
| Exploitation reported, CVE 90 days old or newer (v1 rule 3) | 15.6% (12 to 20); 55/352 |
| Same, a non Telegram reporter | 31.4% (19 to 48); 11/35 |
| Same, Telegram the only reporter | 14.6% (11 to 19); 48/328 |
| Exploitation reported, CVE older than 90 days | 3.6% (2 to 6); 13/357 |
| Ready-made tools on an edge or remote access product | 63.6% (35 to 85); 7/11 |
| Ready-made tools, CVE 90 days or newer | 6.0% (3 to 13); 43/187 |
| Three or more PoC repositories, CVE 30 days or newer | 13.1% (5 to 29); 27/97 |
| Honeypot attempts confirmed (Shadowserver) | 4.7% (0 to 34); 4/21 |
| EPSS 0.5 or higher | 3.3% (0 to 20); 8/120 |
| CVSS 9 or higher with a proof of concept, CVE 30 days or newer | 1.6% (1 to 3); 55/496 |

No single public signal predicts a KEV listing within 30 days at anything like 80%. High EPSS
alone is a poor predictor of a listing: many high EPSS CVEs are attacked at scale and never
listed.

### Reading the results honestly

- The 80% target for early Act now calls is not met and is not close. With public signals alone,
  an early Act now is right a bit under half the time over the whole window, and about a third on
  the held out six months. The held out interval (21% to 53%) overlaps the tuning interval, so the
  drop may be noise, but the point estimate is what it is.
- v2 beats v1 on the held out period on the headline (35.5% against 21.5%, intervals 21 to 53 and
  14 to 31) at the same listing day coverage (94.3%). It makes fewer early calls: 31 against 93 on
  the held out period, and 16 against 29 KEV additions called ahead of the listing. That trade is
  deliberate. The two intervals overlap, so the improvement is likely but not proven.
- Lead time is 4 days at the median for the calls made ahead of a listing, but only 15% of KEV
  additions get such a call. About a fifth of KEV additions were listed on the day the CVE was published,
  so no public signal could have led them.
- Many "wrong" early calls look right on inspection: Erlang/OTP SSH (CVE-2025-32433), Craft CMS
  (CVE-2025-32432), Roundcube (CVE-2025-49113), n8n (CVE-2025-68613) and Sudo (CVE-2025-32463)
  were all reported exploited early and listed later than 30 days after. KEV is a conservative
  ground truth, and the 90 day column shows part of that.
- The wrong early calls in the first draft were dominated by single Telegram posts about CVEs
  from low profile code bases (phpgurukul, pcman, itsourcecode, sourcecodester) that never reach
  KEV. v2 holds those at Watch.

### Known limits

- Small samples. v2 made 113 scoreable early calls over 18 months, 31 of them in the held out
  period. Intervals are wide and the held out figure rests on 11 hits.
- KEV is the only ground truth in this dataset, and it is conservative. VulnCheck KEV would add
  earlier and broader confirmations; the builder reads it when a token is present. Vendor
  confirmed exploitation is defined as truth but not yet collected.
- SSVC "active" is treated as confirmed exploitation in the ladder, and in this data it is
  effectively KEV seen through Vulnrichment. It is not independent evidence.
- v1's tuning cannot be audited from git: its design and its backtest reports were committed
  together, and the first CLI always printed held out results. The gate and the reveal log exist
  from v2 on.
- v2 was chosen among about 25 tuning period variants. One reveal does not remove the risk that
  a simple rule picked that way still fits the tuning period better than the future.
- The never-KEV strata cover CVE records with 2025 and 2026 ids. Never-KEV CVEs with older ids are
  not in the population. Under v1 and v2 they cannot reach Act now before confirmation (the rule
  needs a CVE 90 days old or newer), so this gap touches the Watch and Low figures only.
- The KEV ransomware flag is read as it stands today rather than as of the listing day.
- Metasploit and nuclei dates come from git history since Mar 5, 2025. Older files are treated as
  present from the window start.
- CIRCL Telegram sightings are social posts. They are the main pre listing signal and still the
  main source of wrong early calls. A second post from the same channel counts as a second report.
- EPSS scores are rounded to three decimals and stored as change points.
- The live site only creates events on a KEV listing today (Phase 1 grouping). Pre listing Act
  now calls need events to exist earlier; that is Phase 3 work.
- Sightings of type "confirmed" from CIRCL are counted as proof of concept rather than exploitation, as
  in the live adapter.

## Proposed: rules v3, the Act today tier and a ranking (draft, not live)

Drafted Nov 8, 2026. v3 keeps every v2 verdict and adds two things the home page and the API
need so that the verdict sorts attention again (on Nov 7, 75 of 112 events were Act now):

- **Act today**, a tier inside Act now. Exploitation confirmed by an authoritative source within
  the last 14 days, and at least one of: the product faces the internet or gives remote access
  (category table or the edge patterns), CISA flags ransomware use, ready-made attack tools are
  public. Every other Act now event is tier "now". Watch and Low have no tier.
- **A ranking score** from 0 to 11, the same for every event, one line per factor: +3 exploitation
  confirmed or +1 reported; +2 internet-facing or remote access; +2 ransomware use; +1 attack
  tools; +2 confirmation (or first report) within 7 days, +1 within 21 days; +1 three or more
  affected products or a component other products ship. Lists sort by verdict, then tier, then
  score, then newest evidence. The top 3 to 5 is the top of that order.

Thresholds are named constants in `src/lib/ladder/rules/v3.ts`. The inputs the backtest cannot
see (affected product counts) are left out there, so replayed scores run up to one point low.

**How big would the list have been?** `scripts/backtest/tier-study.ts` replays v3 over every KEV
addition in the dataset, day by day, on the tuning period (May 1, 2025 to Mar 31, 2026, 335 days;
the first 30 days are skipped because listings before the dataset start cannot be seen). Counts
are CVEs; events group CVEs, so event counts run lower.

| Window | In Act today per day, median (90th percentile, max) | Days with none | Days with more than 5 | KEV additions ever in the tier | Median days in the tier |
|---|---|---|---|---|---|
| 14 days | 5 (8, 17) | 1 | 134 | 117 of 228 | 15 |
| 21 days | 7 (11, 17) | 0 | 243 | 118 of 228 | 22 |
| 30 days | 10 (16, 20) | 0 | 292 | 123 of 228 | 31 |

Act now CVEs on the same stratum ran at a median of 126 a day (90th percentile 201). The 14 day
window is the draft: a short list of about five, rarely empty, and the score cuts it to five on
the busier days (the median score of the fifth entry was 6). About half of KEV additions never
reach the tier: old flaws listed long after patching, and products that neither face the
internet nor carry a ransomware or tools flag.

What the backtest cannot say: whether the ranking order is the one readers would choose. The
hit rate figures above do not change, because verdicts do not change. Held out results were not
revealed for this study; the tuning period is enough to size a list.

v3 becomes active when the owner approves it (`CURRENT_RULES_VERSION` in
`src/lib/ladder/rules/index.ts`). Until then events carry no tier or score and lists sort as
before.

## Rebuilding

```
npm ci
npm run backtest:dataset -- --from 2025-04-01 --to 2026-10-01     # about 10 minutes with a warm cache
npm run backtest -- --rules v2 --errors 20                          # tuning period only
npm run backtest -- --rules v2 --reveal-heldout                     # logged; writes reports/backtest/
npx tsx scripts/backtest/sensitivity.ts --rules v2 --reveal-heldout
npx tsx scripts/backtest/signal-study.ts --reveal-heldout
npx tsx scripts/backtest/tier-study.ts --rules v3                   # Act today list size, tuning period
```

The builder caches everything under `.cache/backtest/` (gitignored): the KEV catalog, daily EPSS
files (about 580 files, 1.3 GB), a sparse clone of cvelistV5 for 2025 and 2026 (1.5 GB), shallow
clones of vulnrichment, metasploit-framework and nuclei-templates since Mar 1, 2025, a depth one
clone of PoC-in-GitHub, and the CIRCL sighting pages (one request every 3.5 seconds, about 150
pages). A cold build takes 30 to 60 minutes, mostly network. Every request sends the STP
User-Agent. The dataset is committed when it is under 20 MB.
