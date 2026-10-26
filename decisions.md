# Decisions

Newest first. Owner decisions carry her words where given.

| Date | Decision |
|---|---|
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
