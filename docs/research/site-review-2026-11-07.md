# Site review, Nov 7, 2026

Review of the live prototype at https://securitythreatpulse.com against the owner's direction: highly visual and quick-glance for humans, highly accessible to agents, plain language, framed around "what did you buy, is it affected", with the top 3 to 5 exploited things leading.

How it was done: live HTML and JSON were fetched for /, /events, /events/kev-2026-11-06-sonicwall-sonicos-sslvpn, /brief, /methodology, /about, /corrections, /llms.txt, /api/v1/events, /api/v1/events/{id} and /events/feed.xml. The site was also built and run locally with sample data (no DATABASE_URL) and screenshotted at 1440px and 390px. Screenshots are in `site-review-2026-11-07/`. Screenshots show the sample data set (8 events, "PHP2Shell"); quoted text comes from the live site (112 events) unless noted.

## Verdict

The bones are right and the trust surface is better than most paid products: every claim has a source and a date, the rules are public, the API and feed work without a key, and the ladder is a real visual that reads in a second. The problem is that the live site no longer matches the approved prototype or the owner's Oct 27 direction. The home page opens with one event and a hero paragraph, then shows 24 Act now cards in a row before the first Watch, with no ranking inside Act now other than "newest evidence". There is no top 3 to 5. Seventy-five of 112 events are Act now, so the verdict stops sorting. The "REAL" column and the board brief quote raw NVD sentences ("PHP uses longjmp() for out-of-memory (OOM) errors"), while the "NOISE", "DO THIS WEEK", "Why this is happening" and "Ransomware pulse" blocks are static July text. Vendor matching exists but is hidden behind a button, and matches on vendor name only, so a reader who buys Palo Alto cannot see "affected products" or embedded components. For agents, the shape is good but thin: no structured data, no affected-product list, no CVSS or EPSS fields, and 45 of 51 evidence items withheld on the sample event. The highest-value work is a ranked top 5 at the top of the home page, a real "your vendors" panel, and richer per-event product data for both readers and agents.

## Glance test

What a reader learns in 5 seconds on the live home page at 1440px (`site-review-2026-11-07/home-1440-fold.png` shows the sample-data layout; live text below):

- Strip: "LIVE · LAST RUN SAT NOV 7 08:00 PT · NEXT 08:30 · 4+ RUNS / DAY · 29 SOURCES".
- Hero: "Cut through the noise." plus a three-sentence paragraph.
- Bottom line card: "▲ ACT NOW CVE-2026-19868 · CVSS 7.5" then the h1 "SonicWall SonicOS SSLVPN: security flaw used in attacks" then "It sits at the edge of your network and faces the internet, so attackers can reach it directly. Do this: If you have it, patch it today."
- Counts card: "ACT NOW 75 · WATCH 37 · LOW 0 · Counts follow the published verdict rules."

So in 5 seconds a reader learns one product name, that 75 things are "Act now", and nothing about the other 74. On the prototype (`docs/design/Main.dc.html`) the same slot carried a written judgment: "Attacks are getting faster, not broader. One flaw needs action this week." The live bottom line has no judgment, only a category sentence.

At 390px (`home-390-fold.png`) the fold holds the header, a two-line nav that wraps "BOARD BRIEF" onto its own row, the status strip, the hero, and the top of the bottom line card. The first event title is below the fold. The full phone page is 9,003px tall (`home-390.png`), about 23 screens.

Is there a top 3 to 5? No. The "▲ REAL" column lists the three newest Act now events with their raw technical summaries. The events table that follows lists 36 events, 24 of them Act now, in "newest evidence" order. Nothing ranks within Act now by breadth of exposure, product reach, or age. The owner asked for the top 3 to 5 "known to be exploited in the wild, easy to scan".

Act now count from the API: 75 (`/api/v1/events?verdict=act_now` returns `"total": 75`), out of 112 tracked, with 0 Low. Two thirds of everything is the top verdict, so the label alone cannot drive attention. The home page caps the list to those "with an attack, exploitation or damage report from the last 30 days", which is 24, still too many to glance.

Does the ladder read at a glance? Yes. The five-segment bar with solid, hatched and empty states, plus "HIGHEST CONFIRMED: EXPLOITED" under it, is the strongest visual element on the site (`events-1440.png`, `event-1440.png`). It is also announced to screen readers: `role="img" aria-label="Evidence ladder. talk: confirmed, exposed: no evidence, tried: confirmed, ..."`. One weakness: on the live site 22 of the first 24 Act now events show the same four-solid-one-empty pattern, so the bar does not separate events from each other.

## Visual grammar

- Colour: dark navy background (#0a0e13), light text (#e8eef4), blue accent, red for Act now, amber for Watch, green for Low. Verdict badges are outlined, mono, uppercase. Consistent and restrained. Evidence states use colour plus pattern (solid, hatch, outline), so colour is not the only carrier.
- Hierarchy: the hero "Cut through the noise." is the largest text on the page (60px) and carries no information. The bottom line h1 (the actual news) is second. The counts (75 / 37 / 0) are large numerals with bars, good. Section labels use the "// SECTION" mono convention from the prototype, consistent.
- Density: desktop uses a five-column table (Event, What it is, ladder, Verdict, Do this) for 36 rows. Phone uses cards. Both are readable but long. On the live site every row's "WHAT IT IS" is a category sentence that repeats across rows ("It sits at the edge of your network and faces the internet, so attackers can reach it directly." appears 7 times on the home page), so the column stops carrying information.
- Charts: one bar chart ("FOUND VS USED · INDEX: PRIOR PERIOD = 100", three bars) and four stat tiles. The prototype's "Ransomware pulse" tiles are present. There is no time series, no sparkline, no chart of the live data (for example Act now additions per week, or events by category). All charts use July 2026 sources on a November page.
- Whitespace: generous on desktop, with a 1,280px container. On phone, the status strip wraps to three lines and the nav to two, costing 230px before content.
- Missing for an executive quick look: a ranked top 5 with vendor logos or names in large type, a one-line "this week in one sentence" judgment, a category or vendor breakdown ("11 of 24 Act now are VPN, firewall or gateway"), any trend over time, and a "new since you last looked" marker.

## Plain language

Good examples (live text):

1. Event title: "BeyondTrust Remote Support: attackers can get in without a password".
2. Category why: "It controls many computers at once, so one break-in can reach all of them."
3. Do this: "Patch it. If it faced the internet, change the keys and passwords stored in it."
4. Ask your team (event page): "Have we checked for signs of attack since the first report, not just since the patch?"
5. Fix note: "CISA set Nov 20, 2026 as the deadline for US federal agencies. It is a US government deadline; use it as a guide."

Weak examples (live text):

1. "REAL" column item 02 on the home page and the board brief: "PHP uses longjmp() for out-of-memory (OOM) errors to exit the current context and abort handling of the request." A board reader learns nothing.
2. Category fallback for "Other software", used for Plex, Brotli and Fortinet on the home page: "Plex Media Server contains a server-side request forgery (SSRF) vulnerability which could allow an attacker using any X-Plex-Token value to include a full URL in the…" (raw KEV text, truncated with an ellipsis). The matching "Do this" is "Find out if you use it. If you do, apply the vendor's fix.", which says nothing about Plex.
3. Verdict reason, repeated on most events: "Attacks are confirmed. The vulnerability is 207 days old, so current versions are being attacked." The "so" does not follow; age does not imply that current versions are attacked. On the SonicWall event it reads "The vulnerability is new today, so current versions are being attacked."
4. Title: "Several Fortinet products: attackers can read or change files" sits next to a "What it is" of "FortiOS, FortiPAM, FortiProxy, and FortiSwitchManager contain a path traversal vulnerability that may allow an authenticated attacker with admin profile and at least…". The product list is in the technical text, not the title, and is cut off.
5. Watch item: "Linux: a memory flaw attackers can abuse" with "In the Linux kernel, the following vulnerability has been resolved: ipv4: free inet_opt and ireq_opt after an RCU grace period tcp_v4_syn_recv_sock() transfers ownership…". Kernel changelog text on a page for CEOs.

Pattern: the generated titles and category text are plain. Wherever the site falls back to source text (summary, "Other software" category, board brief "What changed"), it is not. Fourteen of the 50 Act now events on page 1 of the API fall into "other", "endpoint" generic categories where the fallback is used.

## "What did you buy" framing

Can a reader find their vendors fast? Partly. There are two routes:

1. The events table and cards show vendor and product in the title, so scanning works for a short list. On the live home page that is 36 rows.
2. The "VENDORS YOU USE" panel (`src/components/YourVendors.tsx`): a bordered box with the text "Pick the vendors your organization uses to see only the events that apply to you. Your list stays in this browser." and a "CHOOSE VENDORS" button. Until clicked it shows nothing. Clicking fetches every API page (up to 10 requests) and renders a checkbox grid of every vendor string with a count. The chosen vendors are stored in localStorage. Matches then show as a list of title plus "DO THIS" under the panel.

What is good: the mechanism is private (nothing sent to the server), simple, and it works on both the home page and /events.

What is weak against the owner's framing:

- Matching is by the `vendor` string only (`vendorOf(e) = productName(e.vendor, null)`). A reader who buys Palo Alto sees Palo Alto events. A reader whose Fortinet or Cisco appliance embeds PHP, Brotli or BIND sees nothing. The Oct 27 decision asked for "products that embed the flawed component".
- The vendor list is unranked and unfiltered: every vendor in the database, including "EG Secure Solutions", "Gotenberg" and "ICT Innovations", appears alongside Microsoft and Cisco. No search box.
- The panel is below the fold on both widths and visually identical to a notice. Nothing on the page says "start here".
- No product granularity. Cisco has 5 Act now events on page 1 across Secure Email Gateway, ASA, SD-WAN Manager and ISE. A reader who runs only Cisco ASA still sees all five.
- There is no persistent, shareable vendor view (a URL like /vendors/cisco or /events?vendor=cisco). An agent cannot use it at all; the API has no vendor filter.
- The board brief has a row "This week's Act now products in use [STATUS] [WHICH, IF ANY]" left for management to fill in by hand. The site has the data to prefill it from the chosen vendors.

## Agent access

Tested on the live site.

- `/api/v1/events`: JSON, CORS `*`, no key. Envelope: `apiVersion`, `notice`, `generatedAt`, `total`, `page`, `pages`, `events[]`. Each event: `id`, `url`, `title`, `verdict`, `verdictReason`, `rulesVersion`, `ladder` (five rungs, each `confirmed|reported|none`), `cves[]`, `vendor`, `product`, `category {id,label,why,doThis}`, `summary`, `firstSeenAt`, `updatedAt`, `newestEvidenceAt`. Filters: `?verdict=` and `?page=`. 50 per page. Ids are stable slugs (`kev-2026-11-06-sonicwall-sonicos-sslvpn`, `early-cve-2026-109618`).
- `/api/v1/events/{id}`: adds `fix` (text) and `evidence[]` with `rung`, `strength`, `title`, `url`, `publishedAt`, `source {id,name,attribution}`, plus `evidenceWithheld`. On the SonicWall event 6 evidence items were returned and `evidenceWithheld: 45`.
- `/llms.txt`: short, accurate, links the API, MCP endpoint, feeds, methodology and corrections. Good. Cached for an hour with an ETag.
- `/events/feed.xml`: valid RSS 2.0 with atom:self, 30 items, `guid isPermaLink="false"` of the form `id@newestEvidenceAt`, so every evidence update creates a new guid and readers see repeats. Descriptions are the raw summary plus "Why Act now: ...".
- Event pages: no JSON-LD on any page (`application/ld+json` count 0 on home, events, event, methodology). `<time dateTime="...">` is used for the updated, first seen and newest evidence stamps. Source links are plain `<a>` with the source name and a date.
- `/api/mcp` was not exercised in this review.

What an agent would struggle with:

1. No affected-product or version list. `vendor` and `product` are single strings; "Several Fortinet products" carries the products only in free text. No CPE, no "fixed in" version, no embedded-component mapping.
2. No numeric scores. `verdictReason` mentions "The severity score is critical (9.8)" and "The exploit prediction score is 100%", but the JSON has no `cvss` or `epss` field. The agent must parse prose.
3. No filter by vendor, product, CVE, category, or date. To answer "is Cisco ASA affected", an agent must page through 112 events.
4. `verdictReason` is the only machine-readable explanation; the rule that fired is not named (for example `rule: "kev_listed_edge"`). The methodology page describes the rules in prose and tables.
5. Withheld evidence (45 of 51 on the sample event) means the API and the page disagree about how much support an event has. The page shows "10 SOURCES ON THIS EVENT", the API shows 6 items.
6. No OpenAPI or JSON schema document; no `Link` headers for pagination; no `Last-Modified` or `ETag` on API responses (`cache-control: public` only).
7. The feed guid changes on every update, so feed consumers cannot dedupe by event.
8. No per-event JSON link from the HTML page (`<link rel="alternate" type="application/json">`), so an agent that lands on a page must guess the API URL.

## Trust surface

- Sources and timestamps: every stat tile and driver paragraph on the home page carries "SRC: VulnCheck 1H 2026 · Jul 28, 2026" or similar with a link. Every ladder rung on an event page names its source and date. The footer credits HIBP, NVD, EPSS, CISA, CERT-EU and NCSC. Good.
- Corrections: /corrections exists, has an RSS feed and a contact address, and says "No corrections yet." Linked from the footer on every page and from llms.txt.
- Methodology: /methodology renders the full rules document (12 h2 sections: the ladder, the exact conditions v2, the backtest, results, sensitivity, known limits, rules changelog, named organizations, corrections). It is thorough and honest ("Reading the results honestly", "Known limits"). It is only reachable from the footer and llms.txt; nothing near a verdict badge links to "why we rate this way".
- AI labeling: /about says "Text drafted by AI will be labeled as such, and a person reviews it." No AI-drafted text exists yet, so there is nothing to label. The page says "LAST UPDATED OCT 25, 2026".
- Claims: the ransomware tile says "LEAK-SITE CLAIMS · NOT CONFIRMED BREACHES" and the noise item says "Criminal claims, and some are fake." Consistent with the policy.
- Freshness: the strip says "LAST RUN SAT NOV 7 08:00 PT · NEXT 08:30 · 4+ RUNS / DAY". A 30-minute cadence next to "4+ runs a day" reads as a contradiction. The editorial blocks ("NOISE", "DO THIS WEEK", "Why this is happening", "Ransomware pulse", board brief "NOT A CONCERN") all cite April to July 2026 sources on a page dated "WEEK OF NOV 2, 2026". They are labeled, so not misleading, but they are stale.
- Every page carries "PRE-LAUNCH PREVIEW" and "NOT ADVICE". The site is `noindex`.

## Accessibility basics

- Structure: one h1 per page, h2 and h3 in order, `<main id="main">`, `<nav aria-label="Main">`, "Skip to content" link first in the body on every page. Ladder bars have `role="img"` with a full text label. Theme toggle uses `aria-pressed`. The vendor fieldset has an sr-only legend.
- Contrast (measured in the local build): body text #e8eef4 on #0a0e13 is about 16:1; muted #9fb0c0 about 9:1; faint #7f92a6 about 6:1. All pass AA. The red Act now badge and amber Watch badge were not measured, but the text is bold mono at 12 to 13px on a dark field and looks fine in `events-1440.png`.
- Link text: source links are the source name ("CISA Known Exploited Vulnerabilities", "VulnCheck 1H 2026"), not "here". Fine. Footer nav links are uppercase mono at 12px, small but labeled.
- Tap targets on phone (`home-390.png`, measured): 33 links or buttons under 40px tall. Source citation links are 16px high ("VULNCHECK 1H 2026", "Bloomberg Law, Jul 27, 2026", "Have I Been Pwned"). Event title links in the cards are 25px high. "CHOOSE VENDORS" is 34px. The nav links and theme buttons are 36px. The card itself is not a link; only the title is.
- Motion: the LIVE dot pulses; the CSS respects `prefers-reduced-motion`.
- Phone layout: no horizontal scroll at 390px on any of the four pages (scrollWidth 390). The board brief table has `min-w-[460px]` inside an `overflow-x-auto` wrapper, so it scrolls sideways on phone (`brief-390.png`).

## Defects

1. Board brief "WHAT CHANGED THIS WEEK" prints the raw NVD sentence as the explanation ("PHP uses longjmp() for out-of-memory (OOM) errors to exit the current context and abort handling of the request."). It is the first thing a board member reads after the headline.
2. Board brief "BOTTOM LINE" is a count, not a judgment: "CISA confirmed 3 newly exploited flaws in the last 7 days and 35 in the last 30 days. 75 events are rated Act now." The prototype (`docs/design/Board.dc.html`) had "Threat level is elevated but not unusual. One widespread flaw needs fast patching."
3. Event page timeline on the SonicWall event lists eleven rows for Nov 6, nine of them "CVE-2026-19868 discussed publicly (CIRCL sighting)". The Sources list has the same CIRCL line as items [1], [2] and [3], then "[10] CIRCL Vulnerability-Lookup sightings: 42 more reports". The TALK rung text reads "CVE-2026-19868 discussed publicly (CIRCL sighting). CVE-2026-19868 discussed publicly (CIRCL sighting)." with the same SRC line four times. Dedupe by source and day.
4. Date mismatch on the same event: the page strip says "FIRST SEEN NOV 5, 2026"; the API says `firstSeenAt: 2026-11-06T00:00:00.000Z`; the KEV source line says "NOV 5". Midnight UTC rendered in Pacific time shifts the date back a day.
5. Status strip: "NEXT 08:30" with "4+ RUNS / DAY". Pick one cadence to show.
6. "Low · 0" is shown as a count card and as a filter button. With rules v2 nothing is Low, so the third verdict is dead on the live site.
7. "Other software" category falls back to the truncated raw summary with an ellipsis mid-sentence, on the home page, events page and cards.
8. Vendor names are inconsistent in generated titles: "WordPress WordPress Core contains..." (summary), "Collabora Collabora Online – Built-in CODE Server" (summary), "Several Fortinet products" (title) vs "FortiOS, FortiPAM, FortiProxy, and FortiSwitchManager" (text).
9. Feed guids change on every evidence update (`id@timestamp`), so RSS readers show the same event again after each ingest.
10. The sample-data build still shows "3,600+ claimed victims · SRC: ransomware.live" in the ransomware pulse (`home-1440.png`), a source the Oct 24 decision says not to use. The live site omits it. The sample data should match.
11. Nav wraps to two rows at 390px with "BOARD BRIEF" alone on the second line (`home-390-fold.png`).
12. Editorial blocks are hard-coded to July 2026 (`src/lib/data/editorial.ts`): "NOISE", "DO THIS WEEK" item text, drivers, ransomware pulse, board brief "NOT A CONCERN". No date or "last reviewed" on the block itself; only the source dates hint at age.
13. "DO THIS WEEK" item 01 is "Pick the vendors you use in the list below", which is an instruction about the site, not about security.
14. The events page says "Early events ... appear here even when the home page leaves them out", but early events (`early-cve-2026-109618`) do appear on the home page. The sentence is out of date.

## Improvement options, ranked

| # | Option | Reader served | Impact | Effort | Evidence |
|---|---|---|---|---|---|
| 1 | Add a ranked "Top 5 exploited right now" block at the top of the home page: large vendor and product name, one plain line of why, one "do this" line, ladder bar. Rank within Act now by breadth of use (category weight, number of products, EPSS, exploit availability, days in KEV) and publish the ranking rule. | both | high | medium | No top 3 to 5 exists; 24 Act now cards precede the first Watch; `home-1440.png` |
| 2 | Replace the hero paragraph with a one-sentence weekly judgment ("Three edge products need patching this week; nothing else is new.") that is generated from the data and reviewed, and use the same sentence as the board brief bottom line. | human | high | medium | "Cut through the noise." is the largest text; brief bottom line is a count |
| 3 | Rebuild the vendors panel as a first-class "What you use" feature: searchable list ordered by event count, product-level choice (Cisco ASA, not Cisco), a URL for each vendor (`/vendors/cisco`), and the matches shown as the top block when a choice is saved. | both | high | large | `YourVendors.tsx` matches on vendor string only, unranked list, below the fold |
| 4 | Map each event to affected commercial products including embedded components (PHP in appliances, Brotli in browsers and CDNs, BIND in DNS appliances), stored as structured `affectedProducts[]` and shown as chips on cards and event pages. | both | high | large | Oct 27 decision; Fortinet and Plex events carry products only in truncated text |
| 5 | Expose `affectedProducts`, `cvss`, `epss`, `exploitAvailable`, `kevListed`, `kevDueDate`, `ruleFired` in the API and add `?vendor=`, `?product=`, `?cve=`, `?category=`, `?since=` filters. Publish an OpenAPI document and link it from llms.txt. | agent | high | medium | Scores exist only in `verdictReason` prose; no filters beyond verdict and page |
| 6 | Add JSON-LD on event pages (a `Report` or `Article` with `about` the CVE ids, `datePublished`, `dateModified`, `citation[]` for sources) and `<link rel="alternate" type="application/json">` to the API record. | agent | medium | small | No `application/ld+json` on any page |
| 7 | Write plain "what it is" and "do this" text per product for the "Other software", "endpoint" and "server" categories, or at least never render raw KEV or NVD text with an ellipsis on a list. | human | high | medium | "Plex Media Server contains a server-side request forgery (SSRF)..." on the home page |
| 8 | Fix the verdict reason template: drop "so current versions are being attacked"; say "Attacks are confirmed (CISA KEV, Nov 6). The product faces the internet." and name the rule. | both | medium | small | "The vulnerability is new today, so current versions are being attacked." |
| 9 | Board brief: generate "What changed" from the plain title, category why and do this, never the summary; prefill "Our position" from the reader's saved vendors; show the ladder for the top event only when it differs from the rest. | human | high | small | Brief item 02 quotes longjmp(); `[STATUS]` placeholders |
| 10 | Dedupe evidence by source, title and day on event pages (timeline and sources), and collapse CIRCL sightings into one line with a count. | both | medium | small | Nine identical CIRCL rows; sources [1] to [3] identical |
| 11 | Put a dated "Last reviewed" stamp on every editorial block and move the July noise, drivers and ransomware text into a reviewed weekly editorial, or hide a block whose sources are older than 60 days. | human | medium | small | All editorial sources dated Apr to Jul 2026 on a Nov page |
| 12 | Add one chart of live data: Act now additions per week for the last 12 weeks, and a category breakdown of this week's Act now ("11 of 24 are VPN, firewall or gateway"). | human | medium | medium | Only chart is a three-bar index from July sources |
| 13 | Show "NEW" and "CHANGED" markers on events whose verdict or highest rung moved since the previous run, and a "since your last visit" count stored in the browser. | human | medium | medium | Nothing on the page shows what moved today |
| 14 | Stable feed guids (`isPermaLink="true"` with the event URL) and a separate "changes" feed for rung or verdict moves. | agent | medium | small | guid is `id@newestEvidenceAt` |
| 15 | Reconsider the Act now threshold or add a tier inside it (for example "Act today" for edge products with exploit code and a KEV deadline inside 14 days). Seventy-five of 112 Act now and zero Low means the verdict stops sorting. | both | high | medium | API `total: 75` Act now, Low 0 |
| 16 | Status strip: show one cadence ("Checked every 30 min · last 08:00 PT"), and move "29 sources" to a link to the source registry. | human | low | small | "NEXT 08:30" beside "4+ RUNS / DAY" |
| 17 | Fix the first-seen date shift: render KEV dates as dates, not midnight UTC in Pacific time. | both | medium | small | Page "NOV 5", API `2026-11-06T00:00:00Z` |
| 18 | Phone fold: collapse the status strip to one line and the nav to one row (icon menu or shorter labels), so the first event title is visible without scrolling at 390px. | human | medium | small | `home-390-fold.png` |
| 19 | Make the whole card tappable and give source links a 44px hit area with padding on phone. | human | medium | small | 33 targets under 40px, source links 16px high |
| 20 | Link "Why this verdict" and every verdict badge to the matching section of /methodology, and show the rules version next to the badge. | both | medium | small | Methodology reachable only from the footer |
| 21 | Add ETag and Last-Modified to API responses and `Link: rel="next"` pagination headers. | agent | low | small | API sends `cache-control: public` only |
| 22 | Return the withheld evidence as counts by source with a terms note (`withheld: [{source, count, reason}]`), so an agent can judge support without the items. | agent | medium | small | `evidenceWithheld: 45` of 51 on the sample event |
| 23 | Update the sample data to match the live site (remove ransomware.live tile, use the current category and do-this fields) so previews and screenshots show the real design. | human | low | small | `home-1440.png` shows "3,600+ · SRC: ransomware.live" |
| 24 | Remove or hide the Low count card and filter until rules produce Low verdicts. | human | low | small | "LOW · 0" on home and /events |
| 25 | Normalize vendor and product names at ingest (drop "WordPress WordPress", "Collabora Collabora", split "Several Fortinet products" into product chips). | both | medium | medium | Summary and title text on the live events page |

## Screenshots

- `site-review-2026-11-07/home-1440.png`, `home-1440-fold.png`
- `site-review-2026-11-07/home-390.png`, `home-390-fold.png`, `home-390-cards.png`
- `site-review-2026-11-07/events-1440.png`, `events-390.png`, `events-390-top.png`
- `site-review-2026-11-07/event-1440.png`, `event-390.png`
- `site-review-2026-11-07/brief-1440.png`, `brief-390.png`

All were taken from the local build with sample data, deviceScaleFactor 1, full page.
