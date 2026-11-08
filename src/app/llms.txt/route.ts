import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

const BODY = `# Security Threat Pulse

> A free, vendor-neutral view of what is happening in cybersecurity: what is real, what is noise,
> and what deserves attention. Built for security leaders, executives, boards, insurers, investors
> and their agents. Not a tool for security operations teams. Not advice.

Every event sits on a five-rung evidence ladder: 1 Talk, 2 Exposure, 3 Attack attempts,
4 Confirmed exploitation, 5 Confirmed damage. Each rung is confirmed, reported or none.
Verdicts (act_now, watch, low) come from versioned, published rules. No model picks a verdict.

## Data for agents

- [Events API](${SITE_URL}/api/v1/events): JSON, newest evidence first. Filter with ?verdict=act_now|watch|low, ?product=fortinet/fortios (vendor, product or slug), ?cve=CVE-2026-12345, ?since=<ISO time> (a changes feed), and page with ?page=2. No key. Each event carries affectedProducts, cvss, epss, exploitMaturity, kevListed, kevDateAdded, kevDueDate, and from rules v3 a tier inside Act now ("today" or "now"), rankScore and rankWhy. Lists are in rank order: verdict, tier, score, newest evidence.
- [One event](${SITE_URL}/api/v1/events/{id}): JSON with the ladder, the clock (disclosure, exploit code, first attack report, KEV listing, deadline), distinct sources per rung, verdict reason, CISA's fix and dated, linked evidence.
- [OpenAPI](${SITE_URL}/api/v1/openapi.json): OpenAPI 3.1 with one Event schema shared by every response.
- [MCP server](${SITE_URL}/api/mcp): Streamable HTTP, read only, no key. Tools: list_events, get_event, search_events.
- [Act now feed](${SITE_URL}/events/feed.xml): RSS of events rated Act now.
- [Corrections feed](${SITE_URL}/corrections/feed.xml): RSS of every correction.
- [Health](${SITE_URL}/status.json): JSON with the last complete run, the last attempt, per-source health, the rules version and event counts. Same at /api/v1/health. Check it before trusting a reading.
- [Bulk download](https://github.com/jessepike/sec-threat-pulse/tree/data): nightly snapshot of every event as JSON on the data branch. STP's own fields are CC BY 4.0; evidence keeps its source's terms.

Data from some sources is shown on the site but withheld from the API until their terms allow
re-serving. Responses say how many evidence items were withheld.

## How to read it

- [Methodology](${SITE_URL}/methodology): the ladder, the verdict rules, the backtest and its limits.
- [Corrections](${SITE_URL}/corrections): the public log.
- [Board brief](${SITE_URL}/brief): a one-page weekly summary.

## Use

Cite the event page URL and the date you read it. Respect each source's terms, linked in every
evidence item. Contact: jp@jessepike.dev.
`;

export function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
