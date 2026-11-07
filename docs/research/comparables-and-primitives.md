# Comparables and primitives: what durable public security resources do, and what STP should copy

Research memo. Read date for every source: 2026-11-07. Written for the owner and the build agents.
Opinions are marked as such. Numbers come from the pages listed under Sources; where a page was a
vendor blog or a secondary report, that is said.

## Summary

Durable public resources share five traits. They do one thing and say so. They expose the same facts
to people and machines, in the plainest possible format (JSON, CSV, RSS). They have a visible clock
(last update, cadence). They are honest about what they do not know. And they are cheap to run, with
a funding model that does not bend the content.

The agent-access layer in 2026 is simpler than the hype suggests. What agents actually use: plain
JSON over HTTPS with no key, stable URLs, RSS, CSV dumps, and MCP for tool-shaped access. What is
mostly hype for a site like STP: llms.txt as a visibility lever, schema.org Dataset markup, and the
various `.well-known` MCP discovery proposals, none of which has shipped as a spec.

For humans, the glance grammar that survives criticism is: a small number of statuses with words on
them (not colour alone), one thing highlighted at a time, an explicit evidence or confidence label,
and a visible "what changed" marker. Traffic lights fail when the rules behind them are vague; STP's
published, versioned rules are the fix, so the colours can stay.

STP already has most of the machine layer. The gaps are a changes feed, CSV and bulk export with a
clear license, an OpenAPI document, a health endpoint, and "new since" markers on the human side.

## Stage 1: comparables

Method: opened at least one primary page for each (official docs, about page, or the live page).
CISA's own site refused the session's proxy, so the KEV facts come from the kev-data mirror
announcement and from the feed's known shape. Risky Business pricing and the DBIR's exact incident
count were not on the pages that could be opened and are marked unknown.

| Resource | Audience | One thing it does | Glance format | Cadence | Machine access | License / terms | Why trusted | What is weak |
|---|---|---|---|---|---|---|---|---|
| CISA KEV | Federal agencies, then everyone | Lists CVEs with confirmed exploitation and a due date | One table: CVE, vendor, product, date added, due date, action | Business days, event driven | JSON, CSV, JSON Schema; GitHub mirror with a commit per change | CC0 | Government mandate (BOD 22-01), binary fact, no opinion | No "why", no severity context, no history on cisa.gov itself (the mirror adds it) |
| FIRST EPSS | Vuln management teams, tool builders | Daily probability of exploitation in 30 days per CVE | Score 0 to 1 plus percentile; time series | Daily | REST API with batch, date, time series, threshold filters; gzipped CSV per day since 2021 | Called "open and public"; no license text on the pages opened | Open model, published method, a decade of data | Score meaning is hard for executives; no license statement; no explanation per CVE |
| Have I Been Pwned | Consumers, then enterprises | Tells you whether your email or password is in a known breach | One search box, one answer, breach cards | Event driven | Free API rate limited per IP (1 request per 1.5 s, 429 with Retry-After); k-anonymity password API; paid API keys and domain monitoring | Service terms; data not redistributed | One person, 12 years, public write-ups of every decision, costs "less than coffee" | Scale now needs paid tiers; one person is a bus-factor risk (he tried to sell it in 2019) |
| OSV.dev | Open source tool builders | Canonical vulnerability records across ecosystems in one schema | Record page per ID | Continuous export | REST API, batch, GCS bucket, `all.zip`, `modified_id.csv` for incremental sync | Varies by source: CC-BY 4.0, CC0, Apache, MIT, one CC-BY-NC-ND | Google funded, open schema, every record traceable to its source advisory | License is per source, so consumers must check each one; not for executives |
| Shodan | Researchers, SOCs | Search of internet-exposed devices | Search results, tags, ports | Continuous scanning | CVEDB and InternetDB free with no key; paid API; lifetime membership sale | Terms; paid | Long track record, cheap entry, free side products (CVEDB shows KEV and EPSS per CVE) | Hard for non-specialists; free side products are undocumented on limits |
| GreyNoise (free) | SOC analysts | Says whether an IP is mass scanning the whole internet | Classification badge (benign, malicious, unknown) plus a link | Continuous | Community API, one endpoint, one IP, short answer; paid for context, export, batch | Terms; freemium | Narrow, clear question; the free answer is the key fact | Free answer is deliberately thin; quotas too low for automation |
| Status pages (Statuspage, GitHub) | Customers, on-call | Is the service up, and what is being done | One banner, component rows with five status words, incident timeline with four stages | Real time | `status.json`, `summary.json`, `components.json`, `incidents.json`, RSS, Atom, webhook, email, SMS; indicator is one of none, minor, major, critical | Public, no key | Fixed vocabulary everyone has learned; timestamps on every update | Operators can under-report; "indicator" says nothing about cause |
| ransomware.live | Researchers, journalists, insurers | Tracks ransomware leak site claims in near real time | Counters (419 groups, 33,728 victims), world map, victim lists | Several times a day | Public API, JSON database, RSS, third party MCP server (14 tools) | No license stated; disclaimer that entries are claims, not verified | One person, free, no ads, clear disclaimer, sponsors named | Claims are unverified by design; no data license; donation funded |
| Feedly Threat Intelligence | CTI and vuln teams | CVE Insights Card: one page per CVE with exploitation, trending, CVSS, EPSS, patches, timeline | Card with badges and a timeline | "Real time" | API for paying customers | Paid product | Aggregates many sources into one card; timeline of developments | Paid; AI-estimated CVSS can be mistaken for the real one; vendor page |
| Recorded Future (free) | Security leaders (marketing) | Monthly "CVE landscape" posts and a browser extension | Blog post | Monthly | None public | Vendor content | Insikt Group reputation | The "vulnerability database" page is a landing page with no data; all roads lead to the paid product |
| Verizon DBIR | Executives, boards, insurers | Annual statistics on how breaches happen | Headline percentages, charts, executive summary, industry snapshots | Annual | Free PDF, no form in front of it; VCDB raw incidents on GitHub (VERIS JSON) | Report copyright; VCDB has its own license file | 18 years, named contributors, stated time window, published method | Annual means stale by summer; counts are of contributors' cases, not the world; VCDB is largely dormant |
| SANS ISC | Sysadmins, SOCs | Daily diary and the Infocon level | One colour (green, yellow, orange, red) with a definition each; daily diary | Daily, Infocon on change | `infocon.txt`, `infocon.js`, RSS per diary, an API | Free, volunteer handlers | Volunteer handlers, 20+ years, honest plain writing, Infocon rarely moves so it means something | Infocon is about internet-wide disruption, not your risk; diary is for technical readers |
| Krebs on Security | Everyone in security, press | Investigative reporting on cybercrime | Long articles, 3 to 4 a week | Several a week | RSS, newsletter | Copyright; ad and donation funded | One named reporter, sources he names, corrections in public, reader tips | No structured data; stories not events; depends on one person |
| Risky Bulletin | Security professionals | News briefing three times a week | Short items with links | Mon, Wed, Fri | RSS | Sponsored; paid tier exists, price not found | Named editor (Catalin Cimpanu), consistent format, sponsors kept separate | No structured data; a newsletter cannot be queried |
| tl;dr sec | Technical security staff up to CISOs | Weekly curated links with one-line summaries | Numbered issue, sections | Weekly | Email, blog copy of each issue | Sponsorship, two slots per issue, 90k to 120k subscribers, 40% open rate | Editorial independence stated in writing; sponsor blurbs boxed off | Curation not verification; weekly is slow for incidents |
| Vulnerability-Lookup (CIRCL) | CSIRTs, analysts | Correlates vulnerability records from many sources, with sightings | Record page, sightings with typed labels and colours (seen, confirmed, PoC, exploited, patched, and negatives) | Continuous | REST API with token, RSS and Atom, Python client | AGPLv3 software; data license per source | National CERT, open source, sighting types carry negatives (not-exploited, not-patched) | Analyst audience; sightings need critical mass; license of content not stated |
| vulners | Researchers, blue teams | Searchable graph of advisories and exploits | Search results | Continuous | `search/id` free with no credits; bulk and full fields paid | Freemium; bulk is commercial | Made more free in 2025, stated reasons | Free tier returns limited fields; commercial tier is where the real data is |
| Wiz Vulnerability Database | Cloud security teams, SEO traffic | Curated CVE profiles plus the open cloud vulnerability database | Two tables (high profile, most recent): CVE, severity badge, score, technologies, KEV yes/no, fix yes/no, date | Monthly counter, dates near daily | RSS for the site; open-cvdb on GitHub in YAML | CC BY-NC-SA 4.0 (database); CC BY 4.0 (open-cvdb) | Clear badges; KEV and fix flags answer two executive questions | Non-commercial license blocks reuse; counters rendered as placeholders when opened; vendor site |
| Rapid7 AttackerKB | Pen testers, defenders | Crowd assessment of attacker value and exploitability per CVE | Two 1 to 5 scores at the top, assessments below | Imports hourly, assessments when people write them | API with key | Terms via GitHub OAuth; Rapid7 funded | Named assessors, votes, Metasploit team reputation | Sparse outside headline CVEs; opinion scores look like measurements |
| Tenable Cyber Exposure Alerts | Vuln management teams | FAQ style post per big vulnerability, Patch Tuesday round-ups | Blog list; titles carry CVE IDs and counts | Monthly plus event driven | Blog RSS | Vendor copyright | Consistent FAQ format answers "is it exploited, is there a patch" | Vendor, product plugs; no structured data |
| Google Threat Intelligence (Mandiant, GTIG) | Analysts, responders, leaders | Deep reports on actors and campaigns | Headline, summary, byline, reading time (12 to 44 minutes) | Irregular | RSS (FeedBurner) | Copyright | Primary research, named teams, long form evidence | Long; no event index; no structured fields |
| Censys | Researchers, threat hunters | Search of internet hosts and certificates | Search results | Daily snapshots | Community tier with 250 searches a month and 60 days of API; Solo 500; free research access with delay | Non-commercial for research; must cite; redistribution banned | Academic roots, published datasets, citation required | Free tier is thin; research access rejects LLM-written requests |

### What the popular ones have in common

1. **One question, one answer.** KEV: is it exploited. HIBP: am I in a breach. GreyNoise: is this
   IP scanning everyone. Status page: is it up. The resources that try to be a platform (Feedly,
   Recorded Future) end up paid and gated.
2. **The glance is a fixed vocabulary.** Statuspage's four incident stages and five component
   states, ISC's four Infocon colours, Wiz's Yes/No for KEV and fix. Readers learn the words once.
3. **Machine access is boring on purpose.** JSON and CSV at a stable URL with no key is what KEV,
   EPSS, OSV, ISC and status pages offer. Where keys exist (HIBP, Censys, AttackerKB), the reason is
   abuse or cost, and the owner says so in public.
4. **The clock is visible.** Every one of these shows when it last updated, and the trustworthy ones
   say how often they try (EPSS daily, ransomware.live several times a day, KEV business days).
5. **Honesty about limits is part of the product.** ransomware.live says victims are claims.
   Vulnerability-Lookup has `not-exploited` and `not-patched` as first class sighting types. HIBP
   wrote up its rate limit tradeoffs. The DBIR states its time window.
6. **Funding that does not touch content.** One-person projects run on donations and side revenue
   (HIBP, ransomware.live, Krebs). Newsletters sell boxed-off sponsor slots and state editorial
   independence in writing (tl;dr sec). Vendor resources are free marketing, which readers discount.
7. **Change history builds trust.** OSV's `modified_id.csv`, the kev-data mirror's commit per
   change, and status page incident updates with timestamps all let a reader see what moved.

### What is weak across the field

Nobody serves executives well. KEV, EPSS and OSV are facts without meaning. Vendor pages add meaning
with a sales interest. Newsletters add judgement but no structure. The DBIR has the executive
format but is annual. No comparable shows a per-event evidence ladder or publishes the rules that
produce its verdict. That gap is STP's position, and it is real.

## Stage 2: agent access primitives in 2026

| Primitive | Evidence | Verdict |
|---|---|---|
| Plain JSON API, no key, CORS open, cached | KEV, EPSS, OSV, status pages, ransomware.live all do this and are the most used | Matters most. STP has it |
| CSV or bulk dump at a dated URL | EPSS daily CSV, OSV `all.zip`, KEV CSV, VCDB | Matters. Agents and analysts pull whole datasets; STP lacks it |
| Incremental change feed (modified since) | OSV `modified_id.csv`, kev-data git history, Statuspage `incidents.json` | Matters. Lets a caller sync cheaply; STP lacks it |
| RSS or Atom | Every comparable with news-like content offers it; Statuspage, ISC, Krebs, Risky, Google TI | Matters. STP has it for Act now and corrections |
| JSON Feed 1.1 | Spec from 2020; example feeds are personal blogs; no comparable in this set offers one | Nice to have, cheap. Same items as RSS in JSON; agents parse JSON more reliably than XML |
| MCP server | Replicate, ransomware.live (third party), many others; VS Code and Claude Desktop have registry discovery; the official registry was still "in preview" in August 2026 | Matters for tool-shaped access. STP has it. List it in the official registry when it leaves preview |
| `.well-known` MCP discovery files | SEP-1649 server-card and SEP-1960 manifest are open proposals, not merged; two IETF individual drafts with no standing; Replicate ships `/.well-known/mcp/server.json` in the registry's `server.json` format | Hype until merged. Ship only `server.json` at that path, since it costs an hour |
| llms.txt and llms-full.txt | SE Ranking (May 2026): about 10% of 300k domains have one, 0% of the top 1,000; no citation lift after controls. Ahrefs (May 2026): 97% of llms.txt files got zero traffic. 408 requests in 500M AI bot visits in one 90-day log. Google says it does not support it | Not a visibility lever. Keep STP's file because it is cheap and coding agents and MCP clients do read it, but expect nothing from it |
| Accept: text/markdown content negotiation | Cloudflare feature; one site logged about 30 requests a day with that header over 44 days, 500 of them from Claude's infrastructure. Google and Microsoft discourage separate markdown pages | Early but real. STP's event pages are short; serving markdown on request is small effort and helps agents quote cleanly |
| OpenAPI document | Tool builders feed OpenAPI straight to models; one pilot study found JSON Schema cut invalid tool calls by about 31% versus prose docs (small model, no effect on task success) | Matters, small effort. STP has no `openapi.json` |
| JSON Schema on responses | Same study; Anthropic and OpenAI tool definitions are JSON Schema | Publish one schema for the event object and reuse it in OpenAPI and MCP |
| schema.org Dataset markup | Google documents it for Dataset Search; required fields are name and description, license as a versioned URL | Low value for STP. Dataset Search is for research data. Do it only if a CSV dump exists, as 20 lines of JSON-LD |
| Health endpoint | `draft-inadarei-api-health-check` expired in 2022 but its shape (`status` pass, warn, fail; `checks`; `version`; `releaseId`) is widely copied; Statuspage `status.json` has four indicator values | Matters. STP has a DELAYED strip for humans but no machine endpoint |
| Stable citation ids and permalinks | KEV uses CVE ids; OSV ids are permanent and withdrawn records stay; Statuspage incidents keep a shortlink; Claude's web fetch cites by URL and character position, and only fetches URLs already in context | Matters. STP's `/events/{id}` must never change or 404; add `rulesVersion` and `updatedAt` to every page so a quote can be dated |
| Rate limiting without keys | HIBP: 1 request per 1.5 s per IP, 429 with Retry-After, written up publicly; LoadFocus status API: 120 per minute per IP | Matters. Per-IP limit plus Retry-After plus a public note is the pattern |
| Data licensing | KEV CC0; open-cvdb CC BY 4.0; Wiz database CC BY-NC-SA (blocks reuse); OSV per source; Censys non-commercial with required citation; university guidance says CC BY 4.0 fits data and share-alike (ODbL) hurts interoperability | Matters. STP's own facts (ladder, verdict, reason) should be CC BY 4.0; upstream items keep their source's terms, as the API already does |
| How agents cite | Claude's fetch tool only opens URLs already in context, supports text, HTML and PDF, and returns `char_location` citations; vendor pieces about "verified sources" are marketing | A page that is short, dated, has one URL per fact and no JavaScript dependence gets cited correctly. STP's event page should be fully server rendered |

Opinion: the primitives that matter are the ones that existed before 2023. JSON, CSV, RSS, stable
URLs, a dated last update, a license line. MCP is the one genuine addition. Everything with
"agent" in its name should be judged by request logs, and the logs so far favour markdown
negotiation slightly and llms.txt not at all.

## Stage 3: human glance primitives

**Traffic lights.** Three documented failure modes. Stacey Barr: the rules behind red, amber and
green are usually inconsistent, amber is ambiguous, and normal variation gets read as change.
Stephen Few: red and green are indistinguishable for about 10% of men, hues do not encode order,
and colour everywhere trains people to ignore it. Nielsen Norman: colour signals difference but
not magnitude or order, so make it the secondary cue. The fix in every source is the same: few
colours, words on every colour, consistent published rules, and most rows uncoloured so the coloured
ones stand out. STP's verdicts already have words (Act now, Watch, Low) and published rules, which
answers Barr's first objection directly. Keep the colours, keep the words, and let Low rows be grey.

**Evidence ladders and confidence.** Intelligence practice separates two things: how likely the
claim is and how good the evidence is. The Admiralty code rates source reliability A to F and
information credibility 1 to 6 on independent axes. The UK PHIA yardstick maps seven phrases to
probability bands ("realistic possibility" is 40 to under 50%) and adds a confidence rating (high,
moderate, low) with a stated reason. The CCICADA review of cyber sharing found no confidence field
in common feeds, that single-analyst confidence gives a "false sense of precision", and that
non-independent reports form an echo chamber. STP's ladder (five rungs, each confirmed, reported or
none) is a small, honest version of this. Two lessons: count independent sources, not reports, and
show the rung and its strength as words, not as a number.

**Status words and tags.** The GOV.UK tag component: use a tag only when something can have more
than one status, keep the set small, use sentence case, never rely on colour alone, do not make tags
look like buttons. Statuspage's vocabulary (operational, degraded, partial outage, major outage; and
investigating, identified, monitoring, resolved) is the most widely learned status grammar on the
web. STP's rung states (confirmed, reported, none) and verdicts fit this pattern.

**Sparklines.** Tufte: word-sized, data-intense graphics that sit in a table cell or a sentence,
with the latest value marked and a shaded normal band for context. They answer "is this getting
worse" in one glance without a chart. Good for a rung-per-day strip on an event row, or for sources
updated per day on the status strip.

**Heat maps.** Rainbow scales have uneven brightness and arbitrary order, so readers misjudge steps.
Single-hue intensity ramps read as ordered. For STP a heat map has no obvious job; a sorted bar or a
sorted table beats it for "which vendors this month".

**Top N this week.** Nielsen Norman's data table work: the first column must be a readable
identifier, columns in order of importance, filters visible with an "active" indicator. Length and
position are the attributes people judge accurately, so a sorted list beats a cloud or a map.

**Timelines.** Statuspage's incident timeline (stage, message, timestamp, newest first) is the
model. Feedly's CVE card does the same per CVE. The readable unit is "date, source, what changed
rung".

**Change markers.** Interaction Design Foundation: show a snapshot since the last visit, condensed,
with inline links, easy to dismiss. Discourse's experience: "new" and "unread" mean different
things, a count that never clears "haunts you forever", and users preferred a dot to the word. The
rule for STP: mark rows whose verdict or rung changed since the reader's last visit (local storage),
clear on view, and never show a count that cannot reach zero.

**Confidence display.** Show it as a word from a fixed scale with a reason beside it, as PHIA does.
Do not show percentages for judgements that are not computed from data. EPSS percentages are
computed, so they can be shown as numbers with the model named.

## Stage 4: synthesis

### Primitives STP should adopt

| # | Primitive | Serves | Evidence it works | Effort | STP has it |
|---|---|---|---|---|---|
| 1 | Fixed vocabulary for verdicts and rungs, words always next to colour, Low rows uncoloured | Both | GOV.UK tag guidance; Few; Statuspage vocabulary | Small | Partly (words exist; check colour use on Low rows) |
| 2 | Visible clock: last update time, cadence, and DELAYED when stale, on every page and in every API response | Both | Every comparable shows it; Statuspage `page.updated_at` | Small | Partly (strip exists; add `generatedAt` and `nextRunAt` to API and pages) |
| 3 | Machine health endpoint `/api/v1/health` with pass, warn, fail, `checks` per source, `releaseId` and `rulesVersion` | Agent | inadarei draft shape widely copied; Statuspage `status.json` | Small | No |
| 4 | Changes feed: `/api/v1/changes?since=` listing event id, field, old, new, time; same in RSS | Both | OSV `modified_id.csv`; kev-data commit history | Medium | No |
| 5 | Dated bulk export: `/api/v1/export/events-YYYY-MM-DD.csv` and `.json` with a license line | Agent | EPSS daily CSV; KEV CSV; OSV `all.zip` | Medium | No |
| 6 | One license line for STP's own facts (CC BY 4.0), per-item terms for evidence, both in the response and the page footer | Both | KEV CC0; open-cvdb CC BY; university licensing guidance; Wiz's NC license as the counter-example | Small | Partly (API notice says withheld; no license named) |
| 7 | OpenAPI 3.1 document at `/api/v1/openapi.json` with one JSON Schema for the event object, reused by the MCP tools | Agent | Schema-first pilot study; tool definitions are JSON Schema in every major SDK | Small | No |
| 8 | Stable permalinks with versioned quotes: every event page shows `rulesVersion`, `updatedAt`, and a "cite this" line (URL, date, version) | Both | Claude fetch cites by URL; Censys requires citation; OSV ids never die | Small | Partly (ids are stable; no cite line) |
| 9 | Per-IP rate limit with 429 and Retry-After, written up on the methodology page | Agent | HIBP's public write-up; status API 120 per minute | Small | Unknown, check Vercel config |
| 10 | Event timeline: rung changes as dated entries, newest first, each with its source link | Both | Statuspage incident updates; Feedly card timeline | Medium | Partly (evidence list is dated; not shown as rung transitions) |
| 11 | "Changed since you last looked" dot on event rows, cleared on view, no running count | Human | IxDF update alerts; Discourse's findings | Small | No |
| 12 | Top N this week as a sorted table with the identifier first and an active filter indicator | Human | Nielsen Norman data tables and preattentive attributes | Small | Partly (home page lists Act now; check column order) |
| 13 | Independent source count on each rung ("2 independent reports"), not report count | Both | CCICADA echo chamber finding; Admiralty's two axes | Medium | No |
| 14 | Markdown on `Accept: text/markdown` for event pages and the brief, with `Vary: Accept` | Agent | Cloudflare feature; 30 requests a day observed on one small site, half from Claude | Small | No |
| 15 | MCP `server.json` at `/.well-known/mcp/server.json` and a registry listing when the registry leaves preview | Agent | Replicate ships it; VS Code and Claude Desktop read the registry | Small | No |

Dropped after review: schema.org Dataset markup (wrong audience), llms-full.txt (STP has no long
docs to dump), heat maps (no question they answer better than a sorted table), JSON Feed (fine but
adds nothing the API lacks; do it only if it takes under an hour).

### Five unclaimed ideas

Be critical: each of these could fail. The failure mode is listed.

1. **Public track record per rule version.** A page that shows, for each rules version, how often an
   early Act now was right within 30 days, with the Wilson interval, updated by the backtest. No
   comparable publishes its own hit rate. STP already computes it (43%, 35 to 53). Risk: the number
   is unflattering, and readers who skim may take it as "STP is wrong most of the time" rather than
   "STP says so before anyone else and tells you the odds".
2. **Verdict diff for agents.** A `/api/v1/diff?from=&to=` endpoint returning events whose verdict
   moved, with the rule that fired. Lets an agent say "three things went from Watch to Act now since
   your Monday brief". Nobody offers this; status pages come closest. Risk: it is the changes feed
   with a different shape, so build it on primitive 4 or not at all.
3. **"What would change this verdict" line.** On every event, a generated line from the rules
   engine: "This moves to Act now if a second independent exploitation report appears or CISA lists
   it." Executives like knowing the tripwire. No comparable states its own next trigger. Risk:
   it leaks the rules in a way that lets a vendor game them; mitigated because the rules are public
   anyway.
4. **Negative evidence as a first class rung state.** Vulnerability-Lookup has `not-exploited` and
   `not-patched` sighting types but no consumer-facing resource shows "a credible source says this
   is not exploited". STP could add `disputed` next to confirmed, reported, none, and show it. Risk:
   sources rarely publish negatives, so the state would be empty most of the time and the UI would
   carry a column nobody uses.
5. **Board one-liner with a stable id.** Each weekly brief gets a permanent id and a 140-character
   summary meant to be pasted into a board pack or an insurer's questionnaire, with the version and
   date embedded. Insurers and boards are an audience nobody serves with structured, citable text.
   Risk: it tempts marketing language; the plain-language rule has to hold.

## Sources

All read 2026-11-07.

- CISA kev-data mirror announcement (Socket): https://socket.dev/blog/cisa-brings-kev-data-to-github
- CISA KEV catalog (not reachable from this session; cited for the record): https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- FIRST EPSS API: https://www.first.org/epss/api
- EPSS overview (Empirical Security): https://www.empiricalsecurity.com/epss
- HIBP rate limiting and commercial use (Troy Hunt): https://www.troyhunt.com/the-have-i-been-pwned-api-rate-limiting-and-commercial-use/
- HIBP one million subscribers (Troy Hunt): https://www.troyhunt.com/one-million-subscribers-later-heres-the-state-of-have-i-been-pwned/
- Have I Been Pwned (Wikipedia): https://en.wikipedia.org/wiki/Have_I_Been_Pwned%3F
- OSV.dev data sources and distribution: https://google.github.io/osv.dev/data
- Shodan, 5 free things: https://blog.shodan.io/5-free-things-for-everybody/
- GreyNoise, free versus paid: https://www.greynoise.io/blog/7-benefits-of-a-greynoise-paid-plan
- GitHub status: https://www.githubstatus.com/
- Statuspage public API (Atlassian Confluence status): https://confluence.status.atlassian.com/api
- Statuspage incident statuses: https://support.atlassian.com/statuspage/docs/create-an-incident/
- Status page API conventions (LoadFocus): https://loadfocus.com/docs/guides/api-monitoring/status-page-api
- Get-GitHubStatus (PSModule): https://psmodule.io/GitHub/Functions/Status/Get-GitHubStatus/
- ransomware.live about: https://www.ransomware.live/about
- ransomware.live MCP server (LobeHub listing): https://lobehub.com/mcp/cyreslab-ai-ransomware-live-mcp-server
- Feedly CVE Insights Cards: https://feedly.com/new-features/posts/cve-insights-cards-2025
- Recorded Future trending vulnerabilities: https://www.recordedfuture.com/resources/trending-vulnerabilities
- Recorded Future vulnerability database (DE): https://www.recordedfuture.com/de/vulnerability-database
- Verizon 2026 DBIR: https://www.verizon.com/business/resources/reports/dbir/
- VERIS Community Database: https://github.com/vz-risk/vcdb
- SANS ISC Infocon feature: https://isc.sans.edu/diary.html?date=2012-03-15
- Krebs on Security, 9th birthday: https://krebsonsecurity.com/2018/12/happy-9th-birthday-krebsonsecurity/comment-page-1/
- Risky Business News about: https://news.risky.biz/about/
- Risky Business News Substack about: https://riskybiznews.substack.com/about
- tl;dr sec sponsorship: https://tldrsec.com/sponsor
- Vulnerability-Lookup documentation: https://vulnerability.circl.lu/documentation
- Vulnerability-Lookup sightings: https://vulnerability.circl.lu/documentation/sightings.html
- Vulners access update 2025: https://vulners.com/blog/access_update_2025
- Wiz vulnerability database (ES): https://www.wiz.io/es-es/vulnerability-database
- Wiz open-cvdb: https://github.com/wiz-sec/open-cvdb
- AttackerKB FAQ: https://attackerkb.com/faq
- Tenable Security Response Team posts: https://www.tenable.com/profile/tenable-security-response-team?page=1
- Google Cloud Threat Intelligence blog: https://cloud.google.com/blog/topics/threat-intelligence
- Google Cloud Threat Intelligence RSS (Filigran listing): https://hub.filigran.io/en/cybersecurity-solutions/opencti-integrations/google-cloud-threat-intelligence-rss-feed-20260611
- Censys Search Solo: https://censys.com/introducing-censys-search-solo
- Censys research access: https://docs.censys.com/docs/research-access-to-censys-data
- llms.txt request log evidence: https://richdevtools.com/articles/web/llms-txt-evidence-2026
- llms.txt and AI search visibility (Contentful): https://www.contentful.com/blog/llms-txt-search-visibility/
- llms.txt evidence 2026 (1clickreport, vendor blog): https://www.1clickreport.com/blog/llms-txt-evidence-2026
- MCP server cards and roadmap (secondary): https://innvesti.com/reports/mcp-server-cards-roadmap-discovery-tools-2026/
- MCP .well-known discovery proposals: https://alatirok.com/mcp-server-discovery/
- Replicate MCP auto-discovery: https://replicate.com/changelog/2026-02-10-mcp-server-auto-discovery
- Cloudflare Markdown for Agents (Search Engine Land): https://searchengineland.com/cloudflare-markdown-for-agents-469246
- 44 days of Accept: text/markdown logs: https://suganthan.com/blog/cloudflare-markdown-for-agents/
- JSON Feed 1.1: https://jsonfeed.org/version/1.1
- Google Dataset structured data: https://developers.google.com/search/docs/data-types/dataset
- Schema-first tool APIs pilot study: https://arxiv.org/html/2603.13404v1
- OpenAPI instead of MCP: https://www.binwang.me/2025-04-27-Use-OpenAPI-Instead-of-MCP-for-LLM-Tools.html
- Choosing a licence for research data (GCU): https://www.gcu.ac.uk/__data/assets/pdf_file/0015/37212/choosing_a_licence_for_research_data.pdf
- Claude web fetch tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
- Agents and verified sources (Senso, vendor): https://cited.md/article/how-do-agents-fetch-and-cite-verified-content-on-the-agentic-web
- API health check draft: https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check
- Three problems with traffic light dashboards (Barr): https://staceybarr.com/?p=3510
- Bullet graphs for not-to-exceed targets (Few): https://www.perceptualedge.com/blog/?p=217
- Why I stopped using bullet graphs (Nightingale): https://nightingaledvs.com/why-i-stopped-using-bullet-graphs-and-what-i-now-use-instead/
- GOV.UK tag component: https://design-system.service.gov.uk/components/tag/
- GOV.UK colour: https://design-system.service.gov.uk/styles/colour
- DWP status examples: https://design-system.dwp.gov.uk/design-for/status/examples
- Tufte, sparkline theory and practice: https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/
- Admiralty code (Wikipedia): https://en.wikipedia.org/wiki/Admiralty_code
- Confidence assertions in cyber sharing (CCICADA): https://arxiv.org/pdf/2105.07937
- Explaining uncertainty in UK intelligence assessment (PHIA): https://www.gov.uk/government/publications/explaining-uncertainty-in-uk-intelligence-assessment/explaining-uncertainty-in-uk-intelligence-assessment
- Rainbow colour map (Eager Eyes): https://eagereyes.org/basics/rainbow-color-map
- NN/g dashboards and preattentive attributes: https://www.nngroup.com/articles/dashboards-preattentive/
- NN/g data tables: https://www.nngroup.com/articles/data-tables/
- NN/g complex application design: https://www.nngroup.com/articles/complex-application-design/
- Update alerts (IxDF): https://ixdf.org/literature/article/attract-users-attention-with-update-alerts
- Discourse "new" indicator discussion: https://meta.discourse.org/t/tone-down-the-new-indicator-and-change-it-to-mean-never-opened/31393
