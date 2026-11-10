# UI/UX design review, Nov 9, 2026

Mirror of the owner's Claude Doc "STP UI/UX design review, Nov 9 2026". Live site as of Nov 9,
22:52 UTC (116 events, 78 Act now, 38 Watch). Every public page and all ten admin pages were
rendered at 1440 px and 390 px. Admin was reviewed on a local copy filled from the test fixtures.

## Verdict

The first screen does its job: the top 5 with a TODAY badge answers "what do I do first" in five
seconds. Everything below it works against it. The home page is 10,997 px on desktop and 22,485 px
on a phone, shows the same three events three times, and repeats one sentence 21 times. The public
visual language is strong and consistent. The admin console works but reads as a database viewer.

## Public findings

P0 breaks trust or the glance test. P1 costs readers time. P2 is polish. PR is the pull request
that carries the fix (1 quick fixes, 2 home and lists, 3 vendors and admin inbox).

| # | Pri | Finding | Evidence | Fix | PR |
|---|---|---|---|---|---|
| 1 | P0 | Home page is too long | 10,997 px desktop, 22,485 px phone; 39 cards take 14,600 px; weekly chart starts at 19,800 px | Home shows top 5, counts, vendor entry, weekly chart, one link to /events | 2 |
| 2 | P0 | Same three events three times | Top 5, then the REAL column, then table rows 1 to 3 | Drop the REAL column or show what changed this week | 2 |
| 3 | P0 | Repeated sentences | "HIGHEST CONFIRMED: EXPLOITED" 58 times, one "do this" line 21 times, one "what it is" line 18 times | Group rows by category, sentence once per group | 2 |
| 4 | P0 | TODAY badge contrast | White on #ff6b5e is 2.79 to 1 | Dark ink on coral | 1 |
| 5 | P0 | Event page contradicts itself on exploit code | Hero "PROOF OF CONCEPT", clock "NOT YET" | One label in both places; say "claimed" when it is only claimed | 1 |
| 6 | P0 | Duplicate timeline and source rows | One CIRCL sighting title 9 times; sources 1 to 3 identical | One line with a count | 1 |
| 7 | P1 | Two unconnected "my vendors" features | Browser picker on home and events; hand-typed address on /vendors | One feature: checkboxes on /vendors write the address (owner decision, Nov 9) | 3 |
| 8 | P1 | Vendor list duplicates, no search | 76 cards; Arista and Arista Networks; Citrix, Citrix Netscaler and Netscaler | Merge aliases, add a filter box | 3 |
| 9 | P1 | Vendor page lists versions | Microsoft shows 26 chips such as "Windows 10 Version 1507" | Roll up to product families | 3 |
| 10 | P1 | Ladder no longer separates events in lists | 22 of 39 home rows identical, 7 more differ only on Talk | Show tier, days since confirmation, internet-facing in lists | 2 |
| 11 | P1 | Stale July editorial | KPI tiles, drivers, ransomware pulse, NOISE column cite Apr to Jul 2026 | "As of" stamp, or move off home | 2 |
| 12 | P1 | Tracked events card wastes space | Two numbers, then about 400 px empty | Put the vendor entry or chart there | 2 |
| 13 | P1 | Hero headline carries no information | "Cut through the noise." is the largest text | Shrink or show to first-time visitors | 2 |
| 14 | P1 | Board brief quotes raw advisory text | Truncated NVD sentences; "LOW 0" | Plain line plus first step; hide Low at zero | 1 |
| 15 | P1 | Trust pages are footer only | Track record not in the nav; TRENDS is an anchor | TRACK RECORD replaces TRENDS | 1 |
| 16 | P1 | Small text on the event page | 43% of text is 12 px or smaller | 12 px floor | 2 |
| 17 | P1 | Tap targets | 33 of 82 home links under 44 px high | Pad source links; whole card is a link | 2 |
| 18 | P2 | Track record counts read thin | "2 of 2" from one event with two flaws | Say each flaw counts once | 1 |
| 19 | P2 | Dates in three formats | "NOV 6, 2026", "2026-11-06", "Nov 9" | One format for readers | 1 |
| 20 | P2 | Theme toggle at the page bottom | Footer only | Move to the header | 2 |
| 21 | P2 | Page weight | Home HTML 471 KB, events 482 KB | Falls out of 1; 25 rows a page | 2 |

## Admin findings

| # | Pri | Finding | Fix | PR |
|---|---|---|---|---|
| A1 | P1 | Overview is not an inbox | "Needs attention" list with links | 3 |
| A2 | P1 | No active state in the side nav | aria-current and a highlight | 1 |
| A3 | P1 | Unusable on a phone: nav stacks 520 px, tables overflow | Collapse nav, scroll or card tables | 3 |
| A4 | P1 | Sources table hides failures | Failing first, relative times, row menu | 3 |
| A5 | P1 | Disable fires on one click | Confirm first | 1 |
| A6 | P1 | Events list stops at 100, no public link | Paging, TODAY mark, "View" link | 1 |
| A7 | P1 | Ladder colours differ from the public site | Same solid and hatch in blue | 1 |
| A8 | P1 | Event editor: long form, dead AI button | Remove the button, fold groups, preview | 3 |
| A9 | P2 | Scorecard and Roadmap behind the product | Read from live facts and the wave plan | 3 |
| A10 | P2 | Admin has its own tokens and fonts | Use the site variables | 3 |

## Accessibility (axe, WCAG 2.2 AA)

| Issue | Where | Fix | PR |
|---|---|---|---|
| TODAY badge contrast | Every list | Dark text | 1 |
| Focusable chart bars with a label and no role | Weekly chart | role="img" on each bar | 1 |
| Scrolling tables not reachable by keyboard | Board brief, admin Runs and Events | tabindex and a label | 1 |
| Repeated landmark label | Methodology tables | Label from the header row | 1 |
| Content outside landmarks | Brief back link, admin sign-in | nav and main | 1 |
| Empty table header | Admin Sources | Hidden text | 1 |

Already right: skip link, one focus ring in both themes, aria-current on the nav, the ladder
announced in words, pattern as well as colour, reduced motion, clean heading order.

## Decisions taken in pull request 2 (Nov 10)

The owner said to go with the review's recommendations. Finding 1: the home table is cut; `/events` holds every event. Finding 3: lists drop the repeated sentence columns and keep the category label, so rank order stays intact. Finding 11: report figures moved to `/trends` with the date of the newest report.

## Questions for reviewers

1. Is cutting the home table (finding 1) right, or should home keep a short "rest of Act today" list?
2. For finding 3, group by category or drop the repeated columns from lists?
3. For finding 7, checkboxes on /vendors write `?stack=`; the browser remembers the last address. Any
   problem with that for agents or for privacy?
4. Anything in pull request 1 that should wait for the redesign in pull request 2?
