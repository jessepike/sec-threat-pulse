# What leaders need to cut through security noise

Research memo. Written 2026-11-07. Sources read the same day; the full list is at the end.

Purpose: find out what business, security and risk leaders actually need when a security
exposure or event happens, so Security Threat Pulse (STP) builds for real jobs and not for the
jobs that vendor and consulting content says exist.

Method: four stages. Advisory firms and insurers (what they say leaders need), practitioners
(what CISOs and small teams say they want), the business side (how an event becomes a
decision, and who else consumes the information), then a synthesis of jobs to be done.
Every page cited was opened. Where a page is vendor marketing, the memo says so.

## Summary

Leaders do not lack information. They lack three things: a fast answer to "does this touch
us", a way to tell real exploitation from noise, and a format a non-specialist can read in
under a minute. The advisory content agrees on the shape of the need but delivers almost
nothing operational. The practitioner content is clear that scores and alerts are not the
problem; capacity, context and trust are. The free sources that exist (CISA KEV, NVD, vendor
advisories, news) each hold one piece and none of them join the pieces together.

## Stage 1: what advisory firms, board bodies and insurers say

### The questions boards ask

Across NACD, McKinsey, KPMG, EY, WEF and law-firm guidance, board questions cluster into five:

1. Are we within our risk appetite, and if not, where and why? (McKinsey, EY)
2. What is being done about the current risks, and what residual risk remains? (WEF board
   conversations piece, NACD toolkit)
3. Does this event touch us, and what is the business impact? The Bitsight/Forrester list for
   event-driven meetings is the clearest: what happened, what is the impact, is there a
   regulatory issue, were others in our industry hit, what remediation is under way and when
   will it be done.
4. How do we compare with peers? (McKinsey, Bitsight, EY)
5. Are our third parties managed? (KPMG, Google Cloud board poll, WEF)

The NDSS academic study is the most honest source on how this actually works. Board members
often fail to ask the right questions because they fear looking like "IT novices", so they
become dependent on whoever supplies the information, and they tend to reduce cyber to a
budget decision. The authors suggest public benchmarks from cyber agencies as a fix. That is a
gap a neutral, public, rules-based source can serve directly.

The ISTARI and Oxford CEO interviews confirm the picture from the top. 72% of CEOs said they
were not comfortable making cyber decisions. They said they wanted an accurate asset inventory,
the three to five most critical business processes and the technology behind them, quantified
risks rather than generic ratings, and "unbiased status reports" from sources beyond their own
technology team. One CEO quote: "You should not just rely on your technology team telling you
that everything is okay."

### The frameworks

- **Risk appetite and materiality.** The SEC Item 1.05 rule requires an 8-K within four
  business days of deciding an incident is material. The June 2024 staff guidance says ransom
  size, insurance reimbursement and the attack having stopped do not settle materiality;
  quantitative and qualitative effects on operations, finances, brand and customers all count,
  and related small incidents can be material together. Forrester's one concrete 2025
  recommendation on this is to run a "materiality tabletop" with executives and counsel. The
  Google Cloud board poll makes the same recommendation. The arXiv study of 2023 to 2025
  Item 1.05 filings found negative average price reactions, steeper for smaller firms.
- **Exposure management and CTEM.** Gartner's five steps (scoping, discovery, prioritization,
  validation, mobilization) reach the public almost entirely through vendor reprints
  (Darktrace, Armis, Cymulate, Pentera). The one substantive point that survives the marketing:
  boards "don't want CVSS scores. They want to know whether risk is rising or falling, where it
  is concentrated, and what is being done about it." Note that this quote comes from a Pentera
  contributed article, so it is a vendor speaking for boards.
- **Outcome-driven metrics.** Gartner's term, again seen only second hand. Forrester (via
  Bitsight) says activity counts such as malware blocked and phishing filtered measure effort,
  not exposure, and should not go to the board. EY says the same and adds the structure "What?
  So what? Now what?".

### The formats

NACD's 2026 toolkit is the most specific: a standing two-page memo plus dashboard at every
meeting; a one-page incident sheet within 24 hours of a materiality decision covering facts,
impact, containment and disclosure steps; a quarterly thirty-minute deep dive. Content: a
heat map of the top five risks by likelihood and impact, metrics tracked quarter on quarter,
and a two-quarter forward plan. Example target metrics include critical vulnerabilities older
than 30 days under 5% and MFA on critical assets over 98%.

WEF's board-conversation piece proposes seven questions per current risk: what is it, why does
it matter, what could the impact be, what is being done, what progress, what residual risk,
and where does the board add value. Cobalt's advice for vulnerability briefs is a one or two
page brief with impact, recommendation, timeline and a clear ask.

### Insurers

Insurers have the most useful data and the clearest incentives, because they pay when the
guidance is wrong.

- **Coalition 2025:** 58% of 2024 ransomware claims started at a perimeter appliance (VPN or
  firewall); remote desktop was second at 18%. Fortinet, Cisco, SonicWall, Palo Alto Networks
  and Microsoft built the most compromised products. Coalition sent critical alerts for only
  0.15% of published CVEs and 90% of policyholders never got an alert. This is the single best
  public evidence that a tiny, named subset of flaws drives the loss, and that naming the
  commercial product matters more than the CVE.
- **Munich Re 2026:** more than two thirds of large organizations had a third-party incident in
  the past 12 months; supply chain events are "more the norm than the exception"; most claims
  come from micro-companies and SMEs; nearly 9 in 10 C-level respondents do not feel protected.
- **Marsh (Dec 2025):** 70% of organizations had a material third-party incident; 66% plan to
  raise spending.
- **Reed Smith on policy notice:** notice is a condition of coverage, often triggered when the
  company becomes aware of an incident, and late notice can forfeit coverage. IT staff detect
  first and rarely know the policy terms. A public event feed that tells a small company "this
  is the kind of thing your policy expects you to report" is unclaimed.

### What is substance and what is marketing

Substance: NACD's reporting toolkit, the SEC staff guidance, Coalition's claims data, Munich
Re's claims mix, the NDSS and ISTARI interview studies, the Google Cloud board poll
(a vendor, but a real poll of 100 directors with sample sizes shown).

Marketing: the WEF Outlook and the PwC, Accenture and Marsh surveys are percentage lists with
no decision content. Accenture's "only 10% are reinvention ready" is a maturity-model sales
device. Everything attributed to Gartner CTEM reaches the public through vendor landing pages.
The Forrester 2025 CISO post has one useful item (the materiality tabletop) and three product
categories. Nothing from BCG surfaced in search that was not a press summary, so BCG is not
cited.

## Stage 2: what practitioners say they want

### CISOs

The 2026 SANS CTI survey (401 respondents, 67 CISOs) carries the headline: 91% of CISOs value
threat intelligence, 26% say it drives decisions. The top wanted items are vulnerabilities being
actively targeted (79%) and specific adversary tactics (77%). Business-focused intelligence
(supply chain profiles, M&A risk) ranks last at 41%, which SANS reads as a production gap, not
low demand. 57% of programs do not track their own maturity and most CTI teams are under four
people. Intel 471's reading of the same survey (a vendor, but accurate to the survey) is that
the problem is packaging, not accuracy: intelligence does not say what to do next, and the
failure mode is "patch 100 CVEs by Tuesday".

On vendors: the Dark Reading piece by a CISO says "Enough already with the fear, uncertainty,
and doubt"; CISOs want underlying data, transparency about how an alert was generated, and
early value. Gartner's 2024 survey found large enterprises run an average of 45 security tools
across more than 3,000 vendors. Evanta's 2025 CISO poll puts "measuring and communicating
risk" in the top three priorities, with competing priorities and data quality as the blockers.

### Small teams on r/cybersecurity

Two threads read in full. The consistent positions:

- Scores do not solve the problem. "It's really a resource and capacity issue that can't really
  be solved with a tool." "Scoring without context of your threat posture and operational
  capabilities will never keep up."
- The working rule is exposure first. "Affects anything internet facing is patch immediately."
  "Active exploitation comes first, then exploit likelihood, then technical severity" (the Help
  Net Security interview says the same in almost the same words).
- KEV is the trusted signal, EPSS the likelihood add-on, and a public proof of concept is "when
  the real clock starts".
- The stated gap: scores "tell you how bad the vuln is in isolation but nothing about what
  happens after exploitation in your environment."
- Formal risk acceptance with an expiry date and a compensating control is normal practice.
  "Patch or accept" is a real decision, not a slogan.

### What annoys them

- Tools that label everything critical, and vendor advisories that arrive daily.
- Named, branded flaws with proof-of-concept buzz that turn out not to apply (the besthub piece
  lists Heartbleed, Shellshock, KRACK and the NGINX rewrite-if case). Tenable's interviews found
  nearly every noteworthy flaw now gets coverage, so coverage has stopped being a signal, and
  media attention follows exploitation rather than the advisory.
- KEV itself lags. Cybersecurity Dive quotes an expert calling KEV "a trailing indicator"; CISA
  opened public nominations in May 2026 to close the gap. The catalog sits at about 1,600
  entries. NIST has scaled back NVD enrichment. The primary sources are getting slower and
  thinner at the same time as volume rises (Coalition forecast 45,000 CVEs in 2025).

### CISA for small organizations

CISA's Cyber Essentials is written for the leader, not the IT person: six elements, the first of
which is "Yourself: drive cybersecurity strategy, investment and culture." BOD 22-01 tells
private organizations to prioritize KEV entries and subscribe to updates. Neither tells a
business owner which of the 1,600 entries touch the products they own.

### What newsletters do

Risky Business News (three issues a week, written by a former reporter) and tl;dr sec are the
practitioner filters people name. They are curation by a trusted person. They are not
structured, not queryable, and not written for a CEO. The TechCrunch verification guide shows
what good reporting costs: contacting affected people, cross-checking identifiers, hedging
with "likely genuine". Most coverage does not do this, which is why leak-site claims need
labeling.

## Stage 3: how an event becomes a business decision

### The decisions

From TechTarget's supplier-breach guide, the Reed Smith notice piece, the SEC guidance and the
Reddit threads, the decisions an event triggers are a short list:

1. **Does this touch us?** Which products we own embed the flawed component, which suppliers
   run it, which data they hold. This decision gates every other one and is the one nobody
   answers from outside the company.
2. **Patch now, mitigate, or accept.** Interrupt a release schedule or not. The 24 to 72 hour
   target for exploited internet-facing flaws is the practitioner norm; DBIR 2025 found median
   remediation of 32 days overall and Tenable found 209 days for edge-device CVEs against a
   five-day attacker window.
3. **Suspend a vendor's access or not.** The TechTarget playbook's first 24 hours: confirm
   scope, suspend credentials and API keys, block data exchanges.
4. **Notify the insurer or not.** Notice is a coverage condition. Nobody tells the IT team.
5. **Is it material?** Four business days from the decision. Forrester and the Google board poll
   both say rehearse it.
6. **Tell customers or wait.** Black Kite (a vendor, but the observation is sound) describes
   the pattern after every big event: customers mass-mail questionnaires, vendors drown, nobody
   gets an answer. Its advice is to watch vendor status pages first.

### Who else consumes this and in what form

| Reader | What they need | Form today |
|---|---|---|
| MSP or vCISO | A calm, client-ready "this is what it means for you and what we are doing" within hours | Hand-written per client; NinjaOne advises business-impact framing, no jargon, no fear |
| Insurer or broker | Which insureds run the compromised product class; whether the event is the kind policies cover | Internal scanning (Coalition); nothing public and neutral |
| Auditor or audit committee | Evidence that management knew and acted; 87% of audit committees put cyber in their top three (Deloitte/CAQ) | Management's own report |
| Investor or analyst | Which listed companies are exposed, and whether a filing is likely | 8-K scraping after the fact |
| Journalist | Verified exploitation status and a neutral citation | Vendor blogs and leak sites |
| Agent (LLM tool) | Structured facts with sources, timestamps and a rung | None of the above is machine readable |

## Stage 4: jobs to be done

Ranked by how many reader groups share the job and how badly free sources serve it today.
"Automatable" means a rules-based site with public sources can deliver it without opinion.

| # | Reader | Question in their words | Decision it feeds | Format that serves it | Automatable | Served today |
|---|---|---|---|---|---|---|
| 1 | All | "Is this real, or noise?" | Whether to spend any attention at all | Evidence rung with sources and time; a verdict with the rule shown | Yes (core of STP) | Badly; KEV lags, news amplifies everything |
| 2 | CISO, MSP, SMB owner, insurer | "Do we use this? We buy Palo Alto; is Palo Alto affected?" | Does this touch us | Event mapped to commercial vendor products, including embedding products; scan the top five | Partly; product mapping from advisories and KEV, no customer inventory | Not served by any free source |
| 3 | CISO, IT lead | "Is it being exploited in the wild, or is it a proof of concept?" | Patch now vs normal cycle | Rung 3 vs 4 shown distinctly; honeypot attempts never called confirmation | Yes | KEV only, after a lag |
| 4 | CEO, board | "What does this mean for us and what are we doing?" in 30 seconds | Whether to ask management anything | One-paragraph headline verdict with action | Yes | Nothing public; CISO writes it each time |
| 5 | CISO | "What is the clock?" (disclosure date, patch date, PoC date, KEV date, first exploitation report) | Patch or accept; risk acceptance expiry | Timeline on every event | Yes | Scattered across advisories, NVD, KEV, blogs |
| 6 | SMB owner, MSP | "What do I actually do?" | Patch, disable, isolate, or nothing | One line of action per event, vendor-neutral | Yes, with vendor advisory links | Vendor advisories, written for engineers |
| 7 | Board, audit committee, CEO | "Is our exposure rising or falling, and where?" | Resource and appetite decisions | Rolling count of active act-now events by product class | Yes | Not served free; NACD and EY ask for it |
| 8 | CISO, legal, board | "Could this be material for us?" | Materiality tabletop, 8-K timing | Event page notes confirmed damage rung and public filings by others | Partly; STP can show rung 5 and link filings, not decide materiality | Law-firm memos only |
| 9 | Risk manager, SMB owner | "Do we need to tell the insurer?" | Policy notice | Plain note when an event reaches confirmed damage in a product class, with a reminder that notice is a policy condition | Partly; generic, not policy-specific | Not served |
| 10 | CISO, procurement | "Which of our suppliers run this?" and "What are our customers going to ask?" | Vendor access suspension; customer comms | Event page with product mapping plus a suggested customer-facing line | Partly | Mass questionnaires |
| 11 | Insurer, investor, journalist | "Which product classes drove losses, and which listed firms are exposed?" | Underwriting, portfolio risk, story verification | Track record and per-product history, exportable | Yes for history; no for named firms unless official | Coalition internal; nothing neutral |
| 12 | Board, CEO | "How do we compare?" | Appetite and budget | Public benchmark by sector of how fast act-now events were patched (NDSS calls for exactly this from a public agency) | Not yet; needs data STP does not hold | Not served |
| 13 | Everyone | "Who said this, and when?" | Trust | Source and timestamp on every claim; leak-site claims labeled claims | Yes | Rarely done in news |
| 14 | Agents | "Give me the same facts in JSON" | Any of the above, automated | API, MCP, feeds | Yes | Nothing public with rungs and rules |
| 15 | CISO | "Was the site right last time?" | Whether to trust the verdict | Published track record, corrections in public | Yes | No free source keeps score |

### What is unclaimed

- **Jobs 2 and 10, product mapping.** Every source speaks in CVEs. Readers speak in products
  and suppliers. Coalition's data shows five vendors' appliances drive most ransomware entry,
  and the owner's 2026-10-27 decision already points here. No free source maps an exploited
  flaw to the commercial products that embed it. This is the largest gap and the hardest to
  automate well; it is worth the effort because every reader group shares it.
- **Jobs 7 and 12, the rising-or-falling view.** NACD, EY, McKinsey and the NDSS study all ask
  for trend and benchmark. Free sources give lists, never trends.
- **Jobs 8 and 9, the plain reminder.** Nobody connects a public event to "this is the kind of
  thing you must decide materiality on" or "this is the kind of thing your policy expects
  notice of". STP cannot decide either, but it can say which rung an event has reached and that
  these obligations exist. That is new and cheap.
- **Job 15, keeping score.** The SANS finding (valued by 91%, trusted to drive decisions by 26%)
  is a trust problem. A public track record is the direct answer and nobody does it.

### What STP should not try to do

- Decide materiality, coverage or legal exposure for a specific company.
- Replace a company's own asset inventory. STP can say which products are affected; only the
  reader knows what they own.
- Chase coverage of every CVE. Coalition alerted on 0.15%. The value is in the small list.
- Serve boards and insurers with tailored views at this stage. The owner's decision stands:
  one simple view, lead with "do this". The table above shows boards and insurers share jobs 1,
  4, 7 and 13 with everyone else; the differences are in jobs 8, 9, 11 and 12 and those can wait.

## Sources

All read 2026-11-07.

Advisory, board and insurer:

- WEF, Global Cybersecurity Outlook 2026 press release. https://www.weforum.org/press/2026/01/cyber-enabled-fraud-is-now-one-of-the-most-pervasive-global-threats-says-new-report-45dc3f679b/
- WEF, Global Cybersecurity Outlook 2026, chapter 2, CEOs' priorities. https://www.weforum.org/publications/global-cybersecurity-outlook-2026/2-the-view-from-the-top-ceos-priorities-in-a-shifting-cyber-landscape
- WEF, How to create better cybersecurity conversations with the board. https://www.weforum.org/stories/business/how-to-create-better-cybersecurity-conversations-with-the-board
- NACD, Questions boards ask management about cybersecurity (index page). https://nacdonline.org/all-governance/governance-resources/governance-research/questionnaire/questions-board-ask-management-about-cybersecurity
- NACD, 2026 Cyber-Risk Handbook Toolkit, Cybersecurity board reporting. https://www.nacdonline.org/all-governance/governance-resources/governance-research/director-handbooks/2026-cyber-risk-oversight/cyber-risk-handbook-toolkit-2026/cybersecurity-board-reporting/
- McKinsey, Cybersecurity: emerging challenges and solutions for the boards of financial services companies. https://www.mckinsey.com.br/capabilities/risk-and-resilience/our-insights/cybersecurity/cybersecurity-emerging-challenges-and-solutions-for-the-boards-of-financial-services-companies
- KPMG Canada, The board's role in cyber risk governance (PDF). https://assets.kpmg.com/content/dam/kpmg/ca/pdf/2023/12/kpmg-blc-boards-role-in-cyber-risk-governance-eng.pdf
- EY, Enhancing cybersecurity metrics: CISO strategies. https://ey.com/en_us/insights/cybersecurity/enhancing-cybersecurity-metrics-ciso-strategies
- Deloitte Center for Board Effectiveness, Audit Committee Practices Report. https://www.deloitte.com/us/en/programs/center-for-board-effectiveness/articles/audit-committee-report.html
- PwC, 2026 Global Digital Trust Insights, India edition. https://www.pwc.in/2026-global-digital-trust-insights-c-suite-playbook-and-findings-india-edition.html
- Accenture newsroom, State of Cybersecurity Resilience 2025. https://newsroom.accenture.com/news/2025/only-one-in-10-organizations-globally-are-ready-to-protect-against-ai-augmented-cyber-threats
- Forrester, Top recommendations for CISOs in 2025. https://www.forrester.com/blogs/top-recommendations-for-cisos-in-2025-deal-with-uncertainty-again
- TechRepublic, Gartner's top six cybersecurity trends for 2025. https://www.techrepublic.com/article/gartner-cybesecurity-trends-2025/
- Darktrace, 5 steps to build your CTEM program (vendor reprint of Gartner's steps). https://www.darktrace.com/resources/5-steps-to-build-your-ctem-program
- The Hacker News (Pentera contributed), Between buzz and reality: CTEM. https://thehackernews.com/2025/06/between-buzz-and-reality-ctem.html
- BankInfoSecurity, Outcome-driven metrics win board support (ISMG interview). https://www.bankinfosecurity.com/outcome-driven-metrics-win-board-support-a-29530
- Bitsight, What cybersecurity questions the board really wants answered (cites Forrester Consulting). https://www.bitsight.com/blog/what-cybersecurity-questions-the-board-really-wants-answered-in-your-next-report
- BCLP, Cyber-ready boards: a guide to effective cybersecurity briefings for directors. https://www.bclplaw.com/en-US/events-insights-news/cyber-ready-boards-a-guide-to-effective-cybersecurity-briefings-for-directors.html
- Debevoise, SEC releases new guidance on material cybersecurity incident disclosure. https://www.debevoise.com/insights/publications/2024/06/sec-releases-new-guidance-on-material-cyber
- Google Cloud Office of the CISO, Perspectives on security from the board, 2025 poll (PDF). https://services.google.com/fh/files/misc/security-perspectives-on-security-from-the-board-2025-poll.pdf
- ISTARI and Oxford Saïd, The CEO Report on Cyber Resilience (PDF). https://istari-global.com/assets/PDFs/ISTARI_Oxford_The-CEO-Report-on-Cyber-Resilience.pdf
- Oxford Saïd, The CEO Report on Cyber Resilience (summary page). https://www.sbs.ox.ac.uk/research/research-areas/organisation-studies/ceo-report-cyber-resilience
- NDSS, Where are we on cyber? A qualitative study on boards' cybersecurity risk decision making (abstract). https://papers.cool/venue/where-are-we-on-cyber-a-qualitative-study-on-boards-cybersecurity-risk-decision-making@NDSS
- arXiv 2512.06144, Market reactions to material cybersecurity incident disclosures. https://arxiv.org/abs/2512.06144
- Coalition, Cyber Threat Index 2025 announcement. https://www.coalitioninc.com/announcements/cyber-threat-index-2025
- Coalition, Cyber Threat Index landing page (2023). https://web.coalitioninc.com/cyber-threat-index.html
- Munich Re, Cyber insurance: risks and trends 2026. https://www.munichre.com/en/insights/cyber/cyber-insurance-risks-and-trends-2026.en.html
- Marsh (Business Wire), Cyber catalyst report, December 2025. https://www.businesswire.com/news/home/20251209992999/en
- Reed Smith, Best practices for avoiding notification disputes in cyber liability insurance. https://www.reedsmith.com/en/perspectives/cyber-insurance-claims/2023/06/best-practices-avoiding-notification-disputes-cyber-liability-insurance

Practitioner:

- SANS, 2026 Cyber Threat Intelligence Survey insights report (press). https://www.sans.org/press/announcements/2026-cyber-threat-intelligence-survey-insights-report
- Intel 471, What CISOs want from cyber threat intelligence (vendor reading of SANS 2026). https://www.intel471.com/blog/what-cisos-want-from-cyber-threat-intelligence
- Dark Reading, From FUD to fix: why the CISO-vendor partnership needs to change now. https://www.darkreading.com/vulnerabilities-threats/from-fud-to-fix-why-the-ciso-vendor-partnership-needs-to-change-now
- CISO Series, How to be a security vendor CISOs can't ignore. https://ciso-series.beehiiv.com/p/security-vendor-cisos-cant-ignore
- Evanta, Top 3 priorities for CISOs in 2025. https://www.evanta.com/resources/ciso/survey-report/top-3-priorities-for-cisos-in-2025
- Help Net Security, What vulnerability prioritization looks like when KEV, EPSS and CVSS disagree. https://www.helpnetsecurity.com/?p=382902
- r/cybersecurity thread, small-team vulnerability triage (snapshot). https://reddit.sentinel-team.org/posts/1tcv3qu/snapshots/2026-05-15T19%3A38%3A52.790732Z
- r/cybersecurity thread, which CVE details do you focus on (snapshot). https://reddit.sentinel-team.org/posts/1sf4m5v/snapshots/2026-04-10T21%3A06%3A06.339702Z
- Besthub, Why high-risk vulnerabilities often remain unexploitable. https://www.besthub.dev/articles/why-high-risk-vulnerabilities-often-remain-unexploitable-a-security-ops-reality-check-b562363cae2c
- Tenable, Stop the presses: media coverage as a prioritization metric for vulnerability management. https://zh-tw.tenable.com/blog/stop-the-presses-media-coverage-as-a-prioritization-metric-for-vulnerability-management
- Cybersecurity Dive, CISA opens KEV nominations. https://www.cybersecuritydive.com/news/cisa-cve-vulnerability-exploitation-nominations/820870/
- CISA, BOD 22-01 alert. https://cisa.gov/news-events/alerts/2021/11/03/cisa-issues-bod-22-01-reducing-significant-risk-known-exploited
- CISA, Cyber Essentials (archived copy; live page refused the fetch). https://webarchive.library.unt.edu/web/20210104212107/https://www.cisa.gov/cyber-essentials
- Risky Business News, about page. https://riskybiznews.substack.com/about
- Infosecurity Magazine, Verizon DBIR 2025: 34% jump in vulnerability exploitation. https://www.infosecurity-magazine.com/news/verizon-dbir-jump-vulnerability/
- Rapid7, Global Threat Landscape Report 2026. https://rapid7.com/research/report/global-threat-landscape-report-2026/

Business side:

- TechTarget, When a critical supplier gets breached: CISO's response guide. https://www.techtarget.com/cybersecurity/tip/When-a-critical-supplier-gets-breached-CISOs-response-guide
- Black Kite, Why vendor outreach fails after security events. https://blackkite.com/blog/vendor-outreach-isnt-always-the-answer-when-a-high-profile-security-event-hits-your-cyber-ecosystem
- NinjaOne, How MSPs communicate security risk without alarm. https://www.ninjaone.com/blog/communicate-security-risk-without-alarm/
- Cobalt, How to communicate the business impact of vulnerabilities. https://www.cobalt.io/blog/how-to-communicate-the-business-impact-of-vulnerabilities
- TechCrunch, How to verify a data breach. https://techcrunch.com/?p=2679740

Pages opened that gave nothing usable: Defense in Depth episode page (wrong episode returned), CISA Cyber Essentials live page (client error).
