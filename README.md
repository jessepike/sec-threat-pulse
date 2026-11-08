# Security Threat Pulse

https://securitythreatpulse.com

A free, automated, vendor-neutral resource that tells security leaders, executives, boards,
insurers and investors (and their agents) what is happening in cybersecurity, what is real, what is
noise, and what deserves attention this week.

Every event sits on an evidence ladder: Talk, Exposure, Attack attempts, Confirmed exploitation,
Confirmed damage. Each rung is confirmed, reported or missing, and every claim links to its source.
Verdicts (Act now, Watch, Low) come from versioned rules that are backtested and published, never
from model opinion. See the [methodology](https://securitythreatpulse.com/methodology).

The site is in build. It is not indexed yet and not a SOC tool: no IOC feeds, detection rules or
exploit code.

## For agents and developers

- JSON API: `/api/v1/events`, `/api/v1/events/{id}`, `/api/v1/health` (no key, CORS open)
- Health report: `/status.json`
- Act now RSS: `/events/feed.xml` · `/llms.txt` · read-only MCP server at `/api/mcp`
- Bulk download: the `data` branch holds a nightly snapshot of the public API with a manifest

## Working on the code

Next.js 16 on Vercel, Neon Postgres via Drizzle, Vitest. Start with [AGENTS.md](AGENTS.md), then
[status.md](status.md). Copy `.env.example` to `.env.local`; without `DATABASE_URL` the site runs
on sample data.

```
npm install
npm run dev
npm test
```

## License

Code: [MIT](LICENSE). Security Threat Pulse's own fields in the API and snapshot: CC BY 4.0,
attribute as "Security Threat Pulse, https://securitythreatpulse.com". Evidence from each source
keeps that source's own terms (see [docs/source-registry.md](docs/source-registry.md)).
