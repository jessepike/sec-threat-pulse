# Wave 4 launch steps

Written Nov 8, 2026. Every step here is outward facing, so Jesse decides each one. Agents prepare
the step and wait. None of these steps adds a hosting cost.

The site, API, feeds and MCP server are ready. What is ready in the repo:

- `/llms.txt` and `/llms-full.txt` (the index plus the whole methodology in one plain text file)
- `server.json` at the repo root, the listing for the official MCP registry
- The site stays `noindex` until `STP_ALLOW_INDEXING=true` is set in Vercel

## Recommended order

| # | Step | What it does | Undo | Who acts |
|---|---|---|---|---|
| 1 | Make the repo public | CodeQL starts; the data branch becomes a public download | Flip back to private, but copies may exist | Jesse, in GitHub settings |
| 2 | Turn indexing on | Search engines and AI crawlers may list the site | Unset the variable; listings fade over weeks | Jesse sets `STP_ALLOW_INDEXING=true` in Vercel production, then redeploy |
| 3 | List the MCP server | Agents can find the server in the official MCP registry | The registry lets the owner mark a version deleted | Jesse or an agent with Jesse's go ahead, using `mcp-publisher` and DNS or HTTP proof of the domain |
| 4 | Send the permission asks below | Unblocks more evidence (claims, CIRCL re-serving) | An email cannot be unsent | Jesse sends |
| 5 | Send the partnership asks below | Fills the Exposure and Attempts rungs | Same | Jesse sends |

Steps 1 and 2 are independent of each other. Step 3 needs step 1 only if the listing links the
repository. Steps 4 and 5 read better once the site is public, because the reader can look at it.

### Step 3 detail: MCP registry

1. Install the publisher CLI (`mcp-publisher`) from the registry's releases.
2. Prove the domain: `mcp-publisher login dns --domain securitythreatpulse.com` and add the TXT
   record it prints in Cloudflare, or use `login http` with a file under `/.well-known/`.
3. From the repo root: `mcp-publisher publish`. It reads `server.json`.
4. Check the schema URL in `server.json` against the registry docs on the day; it is dated.

Other directories (Smithery, PulseMCP, Glama) pick up the official registry or take a form. Wait a
week after step 3 and check before filling any form by hand.

## Permission asks

### CIRCL (Vulnerability-Lookup sightings)

Why: we use the sightings to fill rungs 1, 3 and 4 and show them on the site. Their data license is
unclear, so we withhold the sighting items from the API and the bulk download.

> Subject: Re-serving Vulnerability-Lookup sightings with attribution
>
> Hello,
>
> I run Security Threat Pulse (securitythreatpulse.com), a free site that tells security leaders
> which flaws are under attack and how sure we are. It is free, has no ads and sells nothing.
>
> We read your sightings API about once an hour, well inside the published rate limit, and we
> show each sighting on our event pages with a link back to the Vulnerability-Lookup record.
>
> We would like to include the sighting type, date and source link in our free public API and
> nightly JSON download, with "CIRCL Vulnerability-Lookup" credited on every item. Today we leave
> them out of both because we could not find a data license.
>
> Is that use fine with you? If you prefer a specific license line or attribution format, tell me
> and we will use it.
>
> Thank you for running the service.
>
> Jesse Pike

### ransomware.live

Why: ransomware victim claims would fill the Damage rung for ransomware events. The policy in
`docs/policy-claims-and-takedown.md` already says how claims would be labeled. The source stays
blocked until written approval.

> Subject: Showing ransomware.live claims with attribution on a free site
>
> Hello,
>
> I run Security Threat Pulse (securitythreatpulse.com), a free site for security leaders and
> boards about which threats are real and which are noise. It has no ads and sells nothing.
>
> We would like to show counts of claimed victims per group and per week, and on some event pages
> the claimed victims, with ransomware.live credited and linked on every item. Every claim would
> be labeled "Claimed by <group>. Not confirmed." We never link to leaked data, and we remove a
> claim when the named organization asks.
>
> We would read your API no more than once an hour. May we do this? If you need a paid plan for
> this use, please tell me the terms.
>
> Jesse Pike

### VulnCheck KEV

No ask for now. Their free tier needs an API token, and the project runs with no API keys
(owner decision, Nov 7, 2026). The adapter stays unconfigured and skips cleanly.

## Partnership asks (Exposure and Attempts rungs)

Today rung 2 (Exposed) is "not tracked yet" everywhere, and rung 3 (Tried) comes only from CIRCL's
copy of Shadowserver honeypot data. One partner on each rung would close the largest gap in the
ladder.

| Partner | Rung | What we would ask for |
|---|---|---|
| Shadowserver | 2 and 3 | Daily counts of exposed and attacked systems per CVE, public dashboard terms or a free feed for a non-commercial site |
| GreyNoise | 3 | Per CVE "attack attempts seen in the last 7 days" from their community data, with attribution |
| CrowdSec | 3 | Per CVE attack counts from the CTI community, with attribution |

The ask is the same for each, so one template:

> Subject: Free, credited use of your per-CVE <exposure | attack> counts
>
> Hello,
>
> I run Security Threat Pulse (securitythreatpulse.com). It puts each security flaw on a five-step
> evidence ladder, from talk to confirmed damage, so leaders can tell real threats from noise. The
> site is free, has no ads and sells nothing. Every fact links to its source.
>
> The weakest rung today is <rung>. Your data is the best public evidence for it. We would like
> one number per CVE per day, <what we need>, shown with your name and a link on every event page
> and in our free API.
>
> We need no raw data, no IP addresses and no indicators. Is there a free or research tier that
> allows this? I am happy to share how the ladder works and what we publish about our accuracy at
> securitythreatpulse.com/track-record.
>
> Jesse Pike
