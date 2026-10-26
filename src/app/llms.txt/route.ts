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

- [Events API](${SITE_URL}/api/v1/events): JSON, newest evidence first. Filter with ?verdict=act_now|watch|low and page with ?page=2. No key.
- [One event](${SITE_URL}/api/v1/events/{id}): JSON with the ladder, verdict reason, CISA's fix and dated, linked evidence.
- [Act now feed](${SITE_URL}/events/feed.xml): RSS of events rated Act now.
- [Corrections feed](${SITE_URL}/corrections/feed.xml): RSS of every correction.

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
