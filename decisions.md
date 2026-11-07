# Decisions

Newest first. Owner decisions carry her words where given.

| Date | Decision |
|---|---|
| 2026-11-07 | Research first, then development: "Let's focus first on refining what would be valuable and how to develop." Findings live in `docs/research/`, plans in `docs/plan/`. The site must be "highly visual and quick glance for humans, highly accessible to agents", covering "the business and operational side of security threats" for CISOs and security leaders, business leaders, and the ecosystem supporting them. Security Market Pulse is the model for stack, architecture, durability, eval and autonomy (see `docs/research/smp-model.md`). |
| 2026-11-07 | The daily routine may merge its own pull requests once checks pass, with 1440 and 390 screenshots on every page change ("Yes to open questions 2&3"). Only a new rules version waits for the owner. |
| 2026-11-07 | Nightly snapshot and bulk download are licensed CC BY 4.0 for STP's own fields; each source's terms pass through and withheld sources stay out. |
| 2026-11-07 | No API keys ("No api keys"): no ANTHROPIC_API_KEY, VulnCheck or NVD key. Written text comes from scheduled Claude Code sessions that open pull requests, or from fixed templates. Verdicts stay rule-only. Deploys are automatic ("Auto"). |
| 2026-11-07 | Build order, agents first or the home page top 3 to 5 first, is deferred to review ("push question 1 to review"). The plan keeps agents first until then. |
| 2026-10-27 | Frame everything around what the reader bought: "they know that they bought something, they procured something... oh, they buy Palo Alto Networks. Is Palo Alto affected by this?" Map each exploited flaw to the commercial vendor products affected, including products that embed the flawed component. Lead with the top 3 to 5 that are known to be exploited in the wild, easy to scan ("short attention spans, too much information"). CISA KEV is a major input, not the only one: "we gotta spread it out" across Microsoft, Google, Cloudflare, Akamai, vendors and government agencies. Exploring (research under way). |
| 2026-10-27 | Audience balance: one simple view for small businesses and large enterprises alike, without tailoring to boards and insurers ("they have a ton of other sources of information"). Lead with "straightforward, simple, do this". The value is aggregating public sources and organizing them for utility; avoid flashiness. |
| 2026-10-25 | Claim-labeling and takedown policy approved ("approve"): name an organization only when an official source does; leak-site listings are always labeled claims; reply to requests within 2 business days; remove unconfirmed claims on request; keep accurate public filings; legal demands go to the owner. See `docs/policy-claims-and-takedown.md`. |
| 2026-10-24 | Owner feedback goes through /admin/roadmap as GitHub issues labeled `feedback`, picked up at the start of each agent session. No scheduled task ("just a way for me to make comments that can be picked up on the next dev session"). One GitHub token per site, limited to that repo. |
| 2026-10-24 | Home page opens with "Cut through the noise." (owner asked for a line on why the site exists). Act now events on the home page limited to those with an exploitation report in the last 30 days. |
| 2026-10-24 | Backtest ground truth is CISA KEV, VulnCheck KEV and vendor confirmed exploitation only. Honeypot hits are attack attempts, never confirmation. Headline figures are population weighted with intervals; "all calls" precision and KEV coverage are secondary. Held-out results stay hidden during tuning and every reveal is logged. |
| 2026-10-24 | Rules v2 active: an early Act now needs two separate exploitation reports or one report plus honeypot attempts. Chosen on the tuning period, revealed once on held-out (35.5% against v1's 21.5%, same listing day coverage). |
| 2026-10-24 | Stack: Vercel Pro, Cloudflare, GitHub, Neon Postgres ("Vercel yes, Cloudflare yes, GitHub"). Neon over Supabase: already in use, preview branching, Supabase extras unneeded. |
| 2026-10-24 | Goal is gate-based, not dated: pass Phases 0 to 2. Agents work continuously; Claude leads. |
| 2026-10-24 | Admin console behind login, including the roadmap. |
| 2026-10-24 | Build-first exploration; real-user feedback at the launch gate. Trust machinery ships in every phase. |
| 2026-10-24 | Audience: security leaders at the core, plus CEOs, boards, insurers, investors and their agents. Not a SOC tool. |
| 2026-10-24 | Dark theme primary, grey an option. |
| 2026-10-24 | ransomware.live not used until written approval (terms bar commercial use and API re-serving). |
| 2026-10-23 | Standalone site, separate from Security Market Pulse. Core concept: evidence ladder with plain verdicts. |
