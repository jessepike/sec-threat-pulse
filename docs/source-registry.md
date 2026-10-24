# Source registry

Verified Oct 24, 2026. The owner's planning doc holds the full table (34 sources). This file lists
what adapters need. Rungs: 1 Talk, 2 Exposure, 3 Attempts, 4 Exploited, 5 Damage.

## P1 (Phase 1 data spine)

| id | Source | Endpoint | Auth | Gives | Terms | Interval |
|---|---|---|---|---|---|---|
| `cisa-kev` | CISA KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` (mirror `https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json`) | none | 4 confirmed; ransomware flag (`knownRansomwareCampaignUse`), `forensicTriage`, `cwes` | CC0 | 60 min; diff on `catalogVersion` |
| `vulncheck-kev` | VulnCheck KEV | `GET https://api.vulncheck.com/v3/index/vulncheck-kev` (Bearer token) | `VULNCHECK_API_TOKEN` | 4 confirmed; exploit links | Free, prominent attribution "VulnCheck KEV" | 180 min; skip cleanly if no token |
| `epss` | FIRST EPSS | `https://api.first.org/data/v1/epss?cve=CVE-a,CVE-b` (batch up to ~100), bulk `https://epss.cyentia.com/epss_scores-YYYY-MM-DD.csv.gz` | none | forecast (not evidence) | Attribution requested | daily; score only CVEs we track |
| `cvelist` | CVE List V5 + CISA Vulnrichment | `https://github.com/CVEProject/cvelistV5` hourly delta release zips; per-CVE raw `https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/{year}/{nnnn}xxx/CVE-....json` | none | identity, CNA data; ADP SSVC `Exploitation: active` = 4 confirmed, `poc` = exploit_available | Royalty-free; Vulnrichment CC0 | 60 min; for tracked CVEs fetch per-CVE JSON |
| `nvd` | NVD API 2.0 | `https://services.nvd.nist.gov/rest/json/cves/2.0?lastModStartDate=&lastModEndDate=` | optional `NVD_API_KEY` | vendor/product (CPE) for KEV CVEs | Notice: "This product uses the NVD API but is not endorsed or certified by the NVD." | 120 min |
| `circl-sightings` | CIRCL Vulnerability-Lookup | `https://vulnerability.circl.lu/api/sighting/?type=seen|published-proof-of-concept|exploited|confirmed` | none (20 req/min) | seen = talk; PoC = exploit_available poc; exploited from Shadowserver honeypots = 3 confirmed, from other sources = 4 reported; confirmed = exploit_available poc (see adapter note) | Data license unclear (confirm) | 60 min; do not enumerate |
| `metasploit` | Metasploit metadata | `https://raw.githubusercontent.com/rapid7/metasploit-framework/master/db/modules_metadata_base.json` (11 MB) | none | exploit_available weaponized | BSD-3 | 360 min; ETag |
| `nuclei` | nuclei-templates | `https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/main/cves.json` | none | exploit_available weaponized (scan-ready) | MIT | 360 min |
| `poc-github` | PoC-in-GitHub | `https://raw.githubusercontent.com/nomi-sec/PoC-in-GitHub/master/{year}/CVE-....json` | none | exploit_available poc (claimed) | CC0 | 180 min; per tracked CVE |
| `exploitdb` | Exploit-DB | `https://gitlab.com/exploit-database/exploitdb/-/raw/main/files_exploits.csv` (10 MB) | none | exploit_available poc | GPLv2, metadata and links only | daily |
| `sec-8k` | SEC EDGAR | `https://efts.sec.gov/LATEST/search-index?q=%22Item%201.05%22&forms=8-K&startdt=YYYY-MM-DD&enddt=YYYY-MM-DD` | none; max 10 req/s; User-Agent with contact | 5 confirmed (public company cyber incident) | Public data | 60 min |
| `hibp` | Have I Been Pwned | `https://haveibeenpwned.com/api/v3/breaches` | none for catalog; real User-Agent | 5 confirmed (breach with counts) | CC BY 4.0, visible attribution with link | 60 min |
| `wa-ag` | Washington AG breaches | `https://data.wa.gov/resource/sb4j-ca4h.json?$order=datesubmitted DESC&$limit=200` | none | 5 confirmed (notice, counts, attack type) | Credit WA AGO | daily |
| `ca-ag` | California AG breaches | `https://oag.ca.gov/privacy/databreach/list-export` (CSV) | none | 5 confirmed (notice) | Public record | daily |

## P1 if capacity

`msrc` (Microsoft CVRF `https://api.msrc.microsoft.com/cvrf/v3.0/updates`, "Exploited: Yes" = 4
confirmed), `euvd`, `ghsa`, `cisa-csaf`.

## Not used yet

ransomware.live (blocked until written approval), Shadowserver, GreyNoise, CrowdSec (partnerships),
Reddit (terms). News and social sources arrive in Phase 3.

## Notes

- NVD has enriched mainly KEV, federal and critical-software CVEs since Apr 15, 2026. Use CVE List
  V5 as the core record.
- Damage observations from breach notices often have no CVE. They attach to events by
  organization name in Phase 3; in Phase 1 they appear in a "Confirmed breaches" feed.
- Every adapter sends the STP User-Agent and has a recorded fixture under
  `src/lib/ingest/__fixtures__/`.
