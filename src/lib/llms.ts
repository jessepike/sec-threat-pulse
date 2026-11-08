import { CURRENT_RULES_VERSION } from "@/lib/ladder/rules";
import { RULES_CHANGELOG } from "@/lib/ladder/rules/changelog";
import { SITE_URL } from "@/lib/site";

/** The /llms.txt index for agents. /llms-full.txt starts with it. */
export const LLMS_TXT = `# Security Threat Pulse

> A free, vendor-neutral view of what is happening in cybersecurity: what is real, what is noise,
> and what deserves attention. Built for security leaders, executives, boards, insurers, investors
> and their agents. Not a tool for security operations teams. Not advice.

Every event sits on a five-rung evidence ladder: 1 Talk, 2 Exposure, 3 Attack attempts,
4 Confirmed exploitation, 5 Confirmed damage. Each rung is confirmed, reported or none.
Verdicts (act_now, watch, low) come from versioned, published rules. No model picks a verdict.

## Data for agents

- [Events API](${SITE_URL}/api/v1/events): JSON, newest evidence first. Filter with ?verdict=act_now|watch|low, ?product=fortinet/fortios (vendor, product or slug), ?cve=CVE-2026-12345, ?since=<ISO time> (a changes feed), and page with ?page=2. No key. Each event carries affectedProducts, cvss, epss, exploitMaturity, kevListed, kevDateAdded, kevDueDate, and from rules v3 a tier inside Act now ("today" or "now"), rankScore and rankWhy, and untrackedRungs (rungs no source we use can fill yet: read none there as unknown). Lists are in rank order: verdict, tier, score, newest evidence.
- [One event](${SITE_URL}/api/v1/events/{id}): JSON with the ladder, the clock (disclosure, exploit code, first attack report, KEV listing, deadline), distinct sources per rung, verdict reason, CISA's fix and dated, linked evidence.
- [OpenAPI](${SITE_URL}/api/v1/openapi.json): OpenAPI 3.1 with one Event schema shared by every response.
- [MCP server](${SITE_URL}/api/mcp): Streamable HTTP, read only, no key. Tools: get_brief, check_stack, list_events, get_event, search_events, get_track_record.
- [Changes](${SITE_URL}/api/v1/changes): JSON of every verdict or ladder change, newest first, each with the state it replaced (?since=<ISO time>, default 7 days, at most 90). Same items as RSS at ${SITE_URL}/events/changes.xml. Cheapest way to keep a copy in sync.
- [Bulk export](${SITE_URL}/api/v1/export/events-latest.csv): today's events as CSV or JSON at a dated URL (events-YYYY-MM-DD.csv or .json), with a license line. Earlier days are on the data branch.
- [Brief](${SITE_URL}/api/v1/brief): JSON of the week's short list, the same top five the home page leads with: up to five Act now events in rank order with why each ranks there and the first step, plus one sentence for the week. RSS at ${SITE_URL}/brief/feed.xml.
- [Check a stack](${SITE_URL}/api/v1/check-stack?products=Fortinet,PAN-OS): JSON, vendors or products in (comma-separated, up to 25), the Act now and Watch events naming each one out.
- [Track record](${SITE_URL}/api/v1/track-record): JSON of how the early Act now calls held up, live and in the backtest, per rules version: right, wrong and pending counts with 95% intervals, lead time before KEV, and every scored call. Human page at ${SITE_URL}/track-record.
- [Act now feed](${SITE_URL}/events/feed.xml): RSS of events rated Act now.
- [Corrections feed](${SITE_URL}/corrections/feed.xml): RSS of every correction.
- [Health](${SITE_URL}/status.json): JSON with the last complete run, the last attempt, per-source health, the rules version and event counts. Same at /api/v1/health. Check it before trusting a reading.
- [Bulk download](https://github.com/jessepike/sec-threat-pulse/tree/data): nightly snapshot of every event as JSON on the data branch. STP's own fields are CC BY 4.0; evidence keeps its source's terms.

Data from some sources is shown on the site but withheld from the API until their terms allow
re-serving. Responses say how many evidence items were withheld.

## How to read it

- [Methodology](${SITE_URL}/methodology): the ladder, the verdict rules, the backtest and its limits.
- [Track record](${SITE_URL}/track-record): how often early Act now calls were right, live and per rules version.
- [Corrections](${SITE_URL}/corrections): the public log.
- [Board brief](${SITE_URL}/brief): a one-page weekly summary.
- [Full text](${SITE_URL}/llms-full.txt): this file plus the whole methodology, the rules changelog and the rules for named organizations, as one plain text file.

## Use

Cite the event page URL and the date you read it. Respect each source's terms, linked in every
evidence item. Contact: jp@jessepike.dev.
`;

/**
 * /llms-full.txt: the llms.txt index plus the methodology in one plain text file, so an agent can
 * read how verdicts are made without fetching HTML. The prose sections mirror /methodology; change
 * both together.
 */
export function llmsFull(rulesDoc: string): string {
  const changelog = RULES_CHANGELOG.map((c) => `- ${c.version} (${c.date}${c.version === CURRENT_RULES_VERSION ? ", active" : ""}): ${c.summary} Backtest: ${c.finding}`).join("\n");
  return `${LLMS_TXT}
---

# Methodology (full text)

Source: ${SITE_URL}/methodology. Rules ${CURRENT_RULES_VERSION} are active.

## The evidence ladder

Every event sits on five rungs. Each rung is confirmed, reported or has no evidence.

1. Talk. Advisories, news and researcher posts discuss the issue.
2. Exposed. Real systems are affected, with a figure from an advisory or a news report.
3. Tried. Someone reports attack attempts. Confirmed exploitation counts as a successful attempt, so when rung 4 is confirmed, rung 3 is confirmed too. Reported exploitation also makes rung 3 reported.
4. Exploited. A trusted list such as CISA KEV, or the vendor, says attacks worked.
5. Damage. A filing, a state notice or a breach record links real harm to the event.

Some rungs read "not tracked yet". That means no source we use can fill that rung for this kind of event, so an empty rung tells you nothing. Today that is Exposed and Damage on flaw events. The API lists these rungs in untrackedRungs.

A site admin can override a verdict. Every override needs a written reason and is logged. No person or AI model picks a verdict by opinion.

## Rules changelog

${changelog}

${rulesDoc.trim()}

## Named organizations and claims

We name an organization only when an official source names it: a regulatory filing, a breach notice or a government advisory. Each name links to that source and its date.

Ransomware leak sites list victims too. Those are claims by criminal groups. Some are false or old. If we show one, we label it as a claim, we never treat it as proof of damage, and we never link to stolen data.

## What we leave out

This is not a tool for security operations teams. We do not publish indicators of compromise, detection rules or exploit code.

## Corrections

Every correction is logged in public with its date and reason at ${SITE_URL}/corrections (RSS at ${SITE_URL}/corrections/feed.xml). If something about your organization is wrong, write to jp@jessepike.dev. We reply within 2 business days.
`;
}
