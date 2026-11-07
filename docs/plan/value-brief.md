# Value brief: what Security Threat Pulse should be, and how to build it

Nov 7, 2026. Synthesis of four research memos written the same day:
[leader-needs.md](../research/leader-needs.md) (what business, security and risk leaders need, 50 sources),
[comparables-and-primitives.md](../research/comparables-and-primitives.md) (22 comparable resources, 70 sources),
[site-review-2026-11-07.md](../research/site-review-2026-11-07.md) (the live prototype, 25 ranked options, 12 screenshots) and
[smp-model.md](../research/smp-model.md) (Security Market Pulse as the model). The Claude Doc "STP world-class plan" is canonical for the plan; this file is the value argument under it.

## The one-sentence product

STP answers one question for people and their agents: **"Is anything we bought being exploited right now, and what do we do this week?"** Every source speaks in CVEs. Every reader speaks in products. Nobody free bridges that gap with evidence and a published rule. That bridge is the product.

## What the research settled

1. **Leaders do not lack information. They lack three things:** a fast answer to "does this touch us", a way to tell real exploitation from noise, and a format a non-specialist reads in under a minute. SANS 2026: 91% of CISOs value threat intelligence, 26% say it drives decisions. The failure is packaging and "what next", not accuracy.
2. **Product mapping is the largest unclaimed job.** Coalition's 2025 claims data: 58% of ransomware claims began at a VPN or firewall appliance, five vendors dominate (Fortinet, Cisco, SonicWall, Palo Alto, Microsoft), and Coalition alerted on 0.15% of CVEs. The value is a small list framed by what you own. This confirms the Oct 27 "what did you buy" decision.
3. **Practitioners rank the same way every time:** active exploitation first, then likelihood, then severity, adjusted for internet exposure. Public exploit code is "when the real clock starts". They want the clock on every event: disclosure, patch, exploit code, KEV listing, first exploitation report. Nobody assembles it.
4. **The primary sources are slowing while volume rises.** KEV is called a trailing indicator; NVD enrichment was cut; 45,000 CVEs forecast for 2025. Media coverage has stopped being a signal. An evidence ladder with independent-source counts is the right answer, and STP already has the ladder.
5. **Boards ask five questions**, and the formats with substance are NACD's (two-page memo plus a dashboard, a one-page incident sheet, a top-five heat map, trend metrics), WEF's seven questions per risk and EY's "What, so what, now what". Activity counts never belong in front of a board. Boards and insurers share jobs 1, 4, 7 and 13 with everyone else, so one simple view still holds.
6. **The durable comparables share six traits:** one question with one answer, a fixed status vocabulary, boring machine access (JSON, CSV, RSS, no key), a visible clock, honesty about limits, and funding kept away from content. No comparable serves executives with structured per-event evidence plus published verdict rules. That slot is open.
7. **Agent access that matters is plain:** JSON, CSV export, a changes feed, RSS, stable ids, a license line, OpenAPI with one JSON Schema, a health endpoint, and MCP. `llms.txt` is not a visibility lever (SE Ranking May 2026: no citation lift; Ahrefs: 97% of files get no traffic). `Accept: text/markdown` is early but real. Drop llms-full.txt and schema.org Dataset markup.
8. **The prototype fails its own brief today.** 75 of 112 events are Act now and 0 are Low, so the verdict no longer sorts attention. There is no top 3 to 5. The vendors panel is a hidden button that matches on vendor strings. Raw KEV text leaks onto the home page and the board brief. Trust surface is strong: every claim sourced and dated, methodology and corrections live.
9. **Visual grammar that works:** words beside every colour, Low rows grey, a sorted table with the identifier first, a dated timeline per event, NEW and CHANGED markers, one live chart. Traffic lights fail on vague rules and amber ambiguity; STP's published rules answer that objection, so keep colour with words.
10. **SMP's two durability mechanisms are the ones to copy:** an outside-host probe and fail-closed publication with "last complete" separated from "last attempt". Its blind-scorer rubric with fit-for-purpose blockers is the reusable eval.

## What valuable means: three layers

| Layer | What the reader gets | Jobs served (from leader-needs.md) | Status today |
|---|---|---|---|
| **1. The small list** | The top 3 to 5 exploited products this week, ranked by a published rule (exploited, internet-facing, breadth of use, exploit code, KEV deadline), each with a plain "what it is" and "do this" line and a one-sentence weekly judgment | 1, 2, 4, 6, 7 | Missing. 24 Act now cards before the first Watch |
| **2. The event page** | The ladder with independent-source counts; the clock (disclosure, patch, exploit code, KEV, first report); affected commercial products including embedding products; "do this"; "what would change this verdict"; a plain note when confirmed damage means disclosure or insurer notice obligations may exist; every claim sourced and dated | 3, 5, 8, 9, 10, 13 | Ladder and sources exist. No clock, no product chips, no tripwire, duplicated evidence rows |
| **3. The record** | Public track record per rules version with intervals; a changes feed; corrections; a dated export with a CC BY 4.0 line; a board one-liner with a permanent id per week | 11, 14, 15 | Backtest exists but is not live or public. Corrections exist. No export, no changes feed |

Agents get the same three layers as JSON: `get_brief`, `check_stack`, `get_event` with the clock and products, `changes?since=`, `health`, `export`.

## Primitives to adopt, by effort

Small, do in Wave 0 and 1: fixed vocabulary with words beside colour and Low rows grey; visible clock and `generatedAt` and `nextRunAt` on every page and response; `/api/v1/health`; OpenAPI 3.1 plus one event JSON Schema reused by MCP; license line; "cite this" line with `rulesVersion` and `updatedAt`; rate limit write-up; `Accept: text/markdown`; `/.well-known/mcp/server.json`; stable feed guids; dedupe evidence rows; fix the verdict reason template and the first-seen date; drop the Low count card.

Medium: changes feed (`since=`) and a changes RSS; dated CSV and JSON export; rung-transition timeline per event; independent-source counts; NEW and CHANGED markers; one live chart (Act now per week, category share this week); JSON-LD on event pages; richer API fields (`affectedProducts`, `cvss`, `epss`, `exploitAvailable`, `kevListed`, `kevDueDate`, `ruleFired`) and filters.

Large: affected-products mapping with embedded components; the "what you use" feature at product level with URLs; the ranking rule and a tier inside Act now.

Dropped: llms-full.txt, schema.org Dataset, heat maps, tailored board and insurer views, JSON Feed unless trivial, deciding materiality or coverage for any named company, chasing every CVE.

## Five unclaimed ideas worth testing

| Idea | Why nobody has it | Failure mode |
|---|---|---|
| Public hit rate per rules version, with intervals | No source keeps score | Skimmers read "wrong most of the time" instead of "called it first, told you the odds" |
| "What would change this verdict" line per event | Rules engines do not expose their next trigger | Vendors could game it; rules are public anyway |
| Obligations note at confirmed damage (materiality, insurer notice) | Law firms write memos, nobody connects them to events | Must never read as advice; one neutral sentence with links |
| Verdict diff for agents (`changes?since=`) | Status pages come closest | It is the changes feed; build it once |
| Board one-liner with a permanent id per week | No structured, citable text for board packs | Tempts marketing language |

## How to develop: the revised order

The research changes one thing in the plan. Open question 1 asked "agents first or the home page top 3 to 5 first". The answer is neither. Both consume the same missing data: affected products, the ranking rule, the clock, and a verdict tier. So Wave 1 becomes the **evidence and product spine**, and the agent contract and the home page both sit on it.

| Wave | Focus | Gate | Change from the Nov 7 plan |
|---|---|---|---|
| 0 | Durable floor and autonomy: outside probe, `/status.json` and `/api/v1/health`, nightly snapshot, daily routine, hygiene, the small fixes (dedupe, verdict template, date shift, Low card, feed guids, sample data) | 7 days fresh with no session; a staged outage caught within 24 hours | Adds the small fixes from the site review |
| 1 | Evidence and product spine: `affectedProducts` with an alias table for the top 200 vendors and embedded components; the ranking rule (versioned, backtested); a tier inside Act now; the clock timeline; independent-source counts; richer API fields and filters; OpenAPI and schema; changes feed and export | The top 5 is computable and published with its rule; a 30-question agent test set passes nightly | New. Merges the data half of the old Wave 1 and Wave 2 |
| 2 | Both surfaces: home page leads with the top 3 to 5 and one weekly sentence; "what you use" at product level with URLs; `get_brief` and `check_stack` tools; one live chart; NEW and CHANGED markers; phone fold and tap targets | Clarity panel 14 of 15; agent set at 100% | Old Waves 1 and 3, built together on the spine |
| 3 | Verdicts worth trusting: live track record published; keyless second exploitation sources (MSRC, EUVD, vendor PSIRTs, CISA ICS); rules v3 with one held-out reveal, Jess approves; tripwire line; obligations note | v3 beats v2 on held-out; the track record page is live | Old Wave 2 |
| 4 | Launch: indexing, MCP registry, permissions, partnerships | Jess says go | Unchanged |

Working method, copied from SMP: every page change ships with 1440 and 390 screenshots; build-time gates for sources, dates and rules version; a weekly health check by the routine; a monthly blind score by two fresh agents against an STP rubric with fit-for-purpose blockers; `lessons.md` read at session start.

## Decisions proposed for the owner

1. Adopt the one-sentence product above and the three-layer model as the test for every feature.
2. Replace open question 1 with the revised order: Wave 1 is the evidence and product spine.
3. Add a tier inside Act now (working name "Act today": internet-facing, exploited, exploit code or a KEV deadline inside 14 days) or raise the Act now bar, so the verdict sorts again. Needs a rules version, so it waits for Jess.
4. Publish the hit rate per rules version on the site, with the interval and the lead-time line beside it.
5. Keep one simple view. No tailored board or insurer pages until the track record exists.

## Open questions

- Product alias table: hand-kept in the repo (reviewable, slow) or derived from NVD CPE plus a hand-kept override list (faster, noisier)? Recommendation: CPE plus overrides, with the override file in the repo.
- Should the weekly judgment sentence be generated by template only, or drafted by the daily routine and checked against evidence ids? Recommendation: template first, routine drafts in Wave 3.
- Where does the obligations note stop being neutral? Recommendation: one fixed sentence per rung 5 state, approved once, linking SEC guidance and a generic insurer-notice explainer.
