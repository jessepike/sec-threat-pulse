# Improve loop ideas

Candidates the loop scores at step 4 of `docs/improve/program.md`. Add ideas freely; the loop adds
its own and parks what needs the owner. Lane, then the metric it should move.

## Coverage (active lane)

- ENISA EUVD as a keyless source: EU vulnerability records and its exploited list. `repo.keylessSources`, then `live.sourcesOk`; check its reuse terms first. The cloud container cannot reach euvdservices.enisa.europa.eu (proxy 403, Nov 16), so a fixture has to come another way.
- `cisa-ics` follow-ups (shipped Nov 20, #60): a document that keeps failing with nothing else new fails the run every 3 hours until it leaves the 30 day window (consider skipping a document after N failures); an event that groups several CVEs from one advisory lists the advisory once per CVE (collapse by URL in the evidence list). Nov 23: all 68 documents changed in 30 days parse, so the guard scores about 0.2; 31 of the 68 name more than one CVE.
- GitHub security advisories (GHSA) as a keyless Talk source, read through OSV's bucket (`https://osv-vulnerabilities.storage.googleapis.com/<ecosystem>/modified_id.csv` with a Range request for the newest rows, then `<ecosystem>/<id>.json` for GHSA ids, CVE ids from `aliases`). CC BY 4.0, credit GitHub. Reachable from the build container and Vercel, no key. `repo.keylessSources` 30 to 31; no verdict metric moves because rules read no Talk. Scored about 0.4 on Nov 25.
- Vendor PSIRT feeds for the most bought vendors (Cisco, Fortinet, Palo Alto Networks, Ivanti), the MSRC pattern: vendor confirmed exploitation as a second exploitation report. `live.earlyActNowShare`, later `bt.kevCalledBeforeShare` once the dataset is rebuilt with them.
- A second exploitation report source so two independent reports can confirm without KEV (BACKLOG Phase 2). `live.earlyActNowShare`.

## Accuracy (next lane)

- Rebuild the backtest dataset with MSRC and any new vendor source, then study single signals again (`scripts/backtest/signal-study.ts`). Tier 2, then the rules tier.

## UX (later)

- Lighthouse at 390px and 1440px in the scorecard (accessibility, performance, SEO), free npm package. Tier 2: it changes the scorecard.
- Blind clarity score: a fresh session scores the home page against the 15-point rubric weekly.

## Growth (later, needs the owner)

- Traffic numbers would need Vercel Web Analytics, which may cost money. Parked for the owner.

## Parked for the owner

- Let the build container reach the sources the coverage lane needs, so a fixture can be recorded:
  euvdservices.enisa.europa.eu, security.paloaltonetworks.com, www.fortiguard.com,
  sec.cloudapps.cisco.com, www.cisa.gov, api.msrc.microsoft.com and www.ivanti.com (all still refused Nov 27). Today only GitHub, Google Cloud Storage, npm and a few
  others answer. The owner adds them under Allowed domains in the project's cloud environment
  (Nov 23). Until then the lane can only add sources hosted on GitHub.

- Install Gemini Code Assist on the repo as a fourth reviewer (owner's click, check the free tier first).
