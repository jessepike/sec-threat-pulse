# Backlog

Mirror of the owner's planning doc. Gates decide when a phase is done.

## Phase 0: Foundations · Gate: live site deployed on securitythreatpulse.com

- [x] Repo, data model, agent docs
- [ ] Vercel project, Neon database, DNS
- [ ] Public site: port of the three prototypes (home, event page, board brief); dark default, grey setting
- [ ] Admin console: login, audit log, Overview, Roadmap, Settings
- [ ] Security baseline: headers, secret scanning, dependency audit, locked-down admin routes
- [ ] Methodology v0, disclosure, terms of use, "not advice" disclaimer, privacy policy, attribution block

## Phase 1: Data spine · Gate: 7 days of unattended fresh updates

- [ ] Adapters: CISA KEV, VulnCheck KEV, CVE List V5 + Vulnrichment, EPSS, NVD, CIRCL sightings,
      Metasploit, nuclei-templates, PoC-in-GitHub, Exploit-DB, SEC EDGAR 8-K, HIBP, WA AG, CA AG
- [ ] Ingest runner, cron route, run bookkeeping, raw archive (R2)
- [ ] Event grouping, ladder computation, verdict rules v0
- [ ] Admin: Sources, Pipeline runs, Events (merge, split, override with reason)
- [ ] Feed health checks, alerts, cost alerts
- [ ] Claim-labeling and takedown policy

## Phase 2: Verdict rules · Gate: accuracy measured and near target

- [x] Verdict rules v1, versioned (v0 kept for replay)
- [x] Backtest harness and 18 months of history (`npm run backtest`, `docs/methodology-rules.md`)
- [x] Independent review of the backtest, corrected measurement, rules v2 (active; v0 and v1 kept for replay)
- [ ] Collect vendor confirmed exploitation and VulnCheck KEV for ground truth; rerun
- [ ] Admin: Rules, Scorecard; public methodology and changelog (draft text in `docs/methodology-rules.md`)
- [ ] Pre listing calls need events before a KEV listing (today events start at the listing)
- [ ] Second exploitation report source so "two independent reports" can confirm without KEV

## Permissions and partnerships (owner sends; agents draft)

- [ ] ransomware.live written approval · VulnCheck agent re-serving · CIRCL data license
- [ ] Shadowserver, GreyNoise, CrowdSec partnership talks (rungs 2 and 3)

## Later phases

3 News and claims · 4 Machine layer (API, RSS, llms.txt, MCP) · 5 Audience views · 6 Launch
