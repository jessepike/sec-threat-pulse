import { RUNGS, type Ladder, type Rung, type RungState, type Verdict } from "@/lib/ladder/types";
import type { ClaimView, EventView, Fact, RoleActions, RungView, SourceRef, TimelineItem } from "./types";

/** Short rung names used across the site. */
export const RUNG_SHORT: Record<Rung, string> = {
  talk: "TALK",
  exposure: "EXPOSED",
  attempts: "TRIED",
  exploited: "EXPLOITED",
  damage: "DAMAGE",
};

/** "ccpnn" style shorthand: c confirmed, p reported, n none. */
function lad(s: string): Ladder {
  const m: Record<string, RungState> = { c: "confirmed", p: "reported", n: "none" };
  const l = s.split("").map((x) => m[x]);
  return Object.fromEntries(RUNGS.map((r, i) => [r, l[i]])) as Ladder;
}

export function topConfirmed(l: Ladder): Rung | null {
  let top: Rung | null = null;
  for (const r of RUNGS) if (l[r] === "confirmed") top = r;
  return top;
}

type RungInput = [string, SourceRef[]];

function rungs(l: Ladder, input: RungInput[]): RungView[] {
  return RUNGS.map((r, i) => ({
    rung: r,
    num: String(i + 1).padStart(2, "0"),
    step: RUNG_SHORT[r],
    state: l[r],
    evidence: input[i][0],
    sources: input[i][1],
  }));
}

const CISA_KEV: SourceRef = { label: "CISA Known Exploited Vulnerabilities", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", at: "2026-10-20" };

interface Def {
  id: string;
  title: string;
  cves: string[];
  idsLabel: string;
  cvss?: number;
  verdict: Verdict;
  ladder: string;
  exposure: string;
  question: string;
  summary: string;
  verdictReason: string;
  rungs: RungInput[];
  facts: Fact[];
  extra?: Partial<EventView>;
  updatedAt: string;
  trackingSince: string;
  sources: SourceRef[];
}

function build(d: Def): EventView {
  const l = lad(d.ladder);
  return {
    id: d.id,
    href: `/events/${d.id}`,
    title: d.title,
    idsLabel: d.idsLabel,
    exposure: d.exposure,
    question: d.question,
    verdict: d.verdict,
    ladder: l,
    topConfirmed: topConfirmed(l),
    cves: d.cves,
    cvss: d.cvss,
    summary: d.summary,
    verdictReason: d.verdictReason,
    exploitMaturity: "none",
    facts: d.facts,
    rungs: rungs(l, d.rungs),
    claims: [],
    timeline: [],
    roles: [],
    sources: d.sources,
    updatedAt: d.updatedAt,
    trackingSince: d.trackingSince,
    ...d.extra,
  };
}

const phpClaims: ClaimView[] = [
  { claim: "\"It is a perfect 10 severity\"", truth: "The leak claimed 10.0. PHP rates both flaws 9.2. Still critical.", rating: "OVERSTATED" },
  { claim: "\"Every PHP site is at risk\"", truth: "Every PHP setup serving web requests is affected until patched.", rating: "TRUE" },
  { claim: "\"Attackers are already using it\"", truth: "Attempts are confirmed by two independent sources. Successful break-ins are not.", rating: "TOO EARLY" },
  { claim: "\"Patching plugins will fix it\"", truth: "No. The flaw is in PHP itself. The PHP runtime must be updated.", rating: "FALSE" },
  { claim: "\"It affects PHP 5 through 8\"", truth: "Fixes cover supported 8.2 to 8.5. Older versions get no patch and stay exposed.", rating: "TRUE" },
];

const phpTimeline: TimelineItem[] = [
  { when: "SEP 21", what: "PHP security team receives the reports and starts on fixes." },
  { when: "OCT 17", what: "Amazon sees the first known exploitation attempt, four days before a fix.", hot: true },
  { when: "OCT 20", what: "Details leak online. PHP announces an emergency release for the next day." },
  { when: "OCT 21 02:00 UTC", what: "Proof-of-concept attack code appears. More attempts follow.", hot: true },
  { when: "OCT 21 14:00 UTC", what: "PHP publishes fixes. watchTowr reports active attempts minutes later.", hot: true },
  { when: "OCT 21", what: "CISA says it has not yet observed exploitation." },
  { when: "OCT 22", what: "Open-source scanner released so teams can test exposure." },
];

const phpRoles: RoleActions[] = [
  { role: "CISO", items: ["Get a full list of PHP servers, including vendor and hosted systems.", "Set a patch deadline in days for anything internet-facing.", "Have the team review logs from Oct 17 forward."] },
  { role: "CIO", items: ["Free up change windows for emergency PHP updates.", "Get written confirmation from hosts and SaaS vendors that they patched.", "Plan replacement of PHP 8.1 and older."] },
  { role: "CEO", items: ["Ask one question: are our public websites and portals patched?", "Support taking a site offline briefly if it cannot be patched.", "No public statement is needed unless a compromise is found."] },
  { role: "BOARD", items: ["Expect a short status from security this week.", "Ask how fast the company can patch a critical internet-facing flaw.", "Treat it as a test of patch speed."] },
];

const php2shell = build({
  id: "php2shell",
  title: "PHP2Shell",
  cves: ["CVE-2026-109618", "CVE-2026-109619"],
  idsLabel: "CVE-2026-109618 / -109619",
  cvss: 9.2,
  verdict: "act_now",
  ladder: "ccpnn",
  exposure: "Any website or app on PHP, including vendor appliances. PHP runs most of the web.",
  question: "Which internet-facing servers run PHP, and are they on a fixed version?",
  summary: "Two critical flaws in PHP itself let an attacker take over a web server without logging in. Attackers tried it before the fix existed. No breaches confirmed yet.",
  verdictReason: "Exposure is very wide, exploit code is public and attempts are reported by two independent sources.",
  rungs: [
    ["Very high. Leaked on Hacker News and social media a day early. National agencies issued warnings.", [
      { label: "BleepingComputer", url: "https://www.bleepingcomputer.com/", at: "2026-10-20" },
      { label: "ITPro", url: "https://www.itpro.com/", at: "2026-10-22" },
    ]],
    ["All PHP installations serving web requests. Exploit code and a public scanner exist.", [
      { label: "PHP security advisory", url: "https://www.php.net/", at: "2026-10-21" },
      { label: "Help Net Security", url: "https://www.helpnetsecurity.com/", at: "2026-10-21" },
    ]],
    ["Amazon saw an attempt Oct 17 from several anonymized sources. watchTowr reports active attempts since Oct 21. Success on real systems is unclear.", [
      { label: "Amazon Threat Intelligence (MadPot)", url: "https://aws.amazon.com/security/", at: "2026-10-17" },
      { label: "watchTowr", url: "https://labs.watchtowr.com/", at: "2026-10-21" },
    ]],
    ["CISA had not observed exploitation as of Oct 21. Not on the KEV list.", [{ label: "CISA", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", at: "2026-10-21" }]],
    ["No public reports of a breach caused by PHP2Shell.", [{ label: "STP breach and SEC filing monitor", at: "2026-10-23" }]],
  ],
  facts: [
    { label: "HIGHEST CONFIRMED RUNG", value: "EXPOSED" },
    { label: "FIRST ATTEMPT SEEN", value: "OCT 17" },
    { label: "FIX AVAILABLE", value: "YES · OCT 21", tone: "ok" },
    { label: "CISA KEV", value: "NOT YET" },
  ],
  extra: {
    exploitMaturity: "poc",
    verdictChangesIf:
      "a CISA KEV listing confirms exploitation. Reports of real compromises move it to the top rung. Falling scan activity plus wide patching moves it to Watch.",
    businessTerms:
      "PHP builds the pages for most websites, including WordPress sites, customer portals and many vendor products. A takeover means stolen data, a defaced site or a foothold into the network.",
    whyAct:
      "Exposure is huge, attack code is public, and attempts are under way from multiple sources. Confirmed breaches arrive too late to prevent one.",
    fix: "Update PHP to 8.5.12, 8.4.27, 8.3.36 or 8.2.35. PHP 8.1 and older get no fix: replace or isolate. Updating plugins alone does not help.",
    claims: phpClaims,
    timeline: phpTimeline,
    roles: phpRoles,
    blast: {
      headline: { value: "~70%", text: "of websites with a known server-side language run PHP" },
      paragraphs: [
        { lead: "Every PHP setup serving web requests:", text: "PHP-FPM, Apache mod_php, php-cgi, FrankenPHP, LiteSpeed. mod_php faces the greatest risk." },
        { lead: "Hidden PHP:", text: "vendor appliances, admin consoles and hosted marketing sites often run it without your team knowing. Ask vendors and hosts directly." },
      ],
      note: "Planned: exposed and vulnerable server counts over time from internet scan data, to show how fast the world is patching.",
    },
  },
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-20T15:00:00Z",
  sources: [
    { label: "PHP security advisory", url: "https://www.php.net/", at: "2026-10-21" },
    { label: "Amazon Threat Intelligence: PHP2Shell attempt in MadPot", url: "https://aws.amazon.com/security/", at: "2026-10-17" },
    { label: "watchTowr: PHP2Shell FAQ and exploitation updates", url: "https://labs.watchtowr.com/", at: "2026-10-21" },
    { label: "Tenable Research: PHP2Shell FAQ", url: "https://www.tenable.com/blog", at: "2026-10-21" },
    { label: "Help Net Security, The Hacker News, ITPro, BleepingComputer", url: "https://www.helpnetsecurity.com/", at: "2026-10-22" },
  ],
});

const kevRung = (what: string): RungInput => [what, [CISA_KEV]];
const noDamage = (): RungInput => ["No public reports of a breach tied to this flaw.", [{ label: "STP breach and SEC filing monitor", at: "2026-10-23" }]];

const citrix = build({
  id: "citrix-netscaler",
  title: "Citrix NetScaler zero-days",
  cves: ["CVE-2026-88771", "CVE-2026-88772"],
  idsLabel: "CVE-2026-88771 / -88772",
  verdict: "act_now",
  ladder: "ccccn",
  exposure: "Remote access and load balancers at the network edge.",
  question: "Do we run NetScaler, and did we check for compromise before patching?",
  summary: "Two flaws in NetScaler appliances each allow remote takeover. CISA confirms global exploitation.",
  verdictReason: "Confirmed exploitation on widely deployed internet-facing systems.",
  rungs: [
    ["Vendor bulletin and national agency alerts.", [{ label: "Citrix security bulletin", url: "https://support.citrix.com/", at: "2026-10-19" }]],
    ["NetScaler appliances used for remote access and load balancing sit at the network edge.", [{ label: "Citrix security bulletin", url: "https://support.citrix.com/", at: "2026-10-19" }]],
    ["Several security firms report attacks.", [{ label: "Security vendor reports", at: "2026-10-19" }]],
    kevRung("CISA added both flaws to its exploited list and confirms global exploitation."),
    noDamage(),
  ],
  facts: [
    { label: "HIGHEST CONFIRMED RUNG", value: "EXPLOITED" },
    { label: "CISA KEV", value: "LISTED" },
    { label: "FIX AVAILABLE", value: "YES", tone: "ok" },
  ],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-19T15:00:00Z",
  sources: [CISA_KEV, { label: "Citrix security bulletin", url: "https://support.citrix.com/", at: "2026-10-19" }],
});

const beyondtrust = build({
  id: "beyondtrust-remote-support",
  title: "BeyondTrust Remote Support",
  cves: ["CVE-2026-102764"],
  idsLabel: "CVE-2026-102764",
  verdict: "act_now",
  ladder: "ccccn",
  exposure: "IT support tools with privileged access to many machines.",
  question: "Do we or our IT providers use BeyondTrust remote support?",
  summary: "A flaw in BeyondTrust Remote Support is on the exploited list. These tools hold privileged access to many machines.",
  verdictReason: "Confirmed exploitation on a tool with privileged reach.",
  rungs: [
    ["Vendor advisory and security press coverage.", [{ label: "BeyondTrust advisory", url: "https://www.beyondtrust.com/trust-center/security-advisories", at: "2026-10-16" }]],
    ["Remote support servers reachable from the internet. Managed service providers often run them for clients.", [{ label: "BeyondTrust advisory", url: "https://www.beyondtrust.com/trust-center/security-advisories", at: "2026-10-16" }]],
    ["Attack attempts reported by security firms.", [{ label: "Security vendor reports", at: "2026-10-17" }]],
    kevRung("CISA added the flaw to its exploited list."),
    noDamage(),
  ],
  facts: [
    { label: "HIGHEST CONFIRMED RUNG", value: "EXPLOITED" },
    { label: "CISA KEV", value: "LISTED" },
  ],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-16T15:00:00Z",
  sources: [CISA_KEV],
});

const ivanti = build({
  id: "ivanti-connect-secure",
  title: "Ivanti Connect Secure",
  cves: ["CVE-2026-104935"],
  idsLabel: "CVE-2026-104935",
  verdict: "act_now",
  ladder: "ccccn",
  exposure: "VPN gateways. A repeat target over several years.",
  question: "Is Ivanti still in our VPN path, and is it on our replacement plan?",
  summary: "A flaw in Ivanti Connect Secure VPN gateways is on the exploited list. The product has been hit many times before.",
  verdictReason: "Confirmed exploitation on internet-facing VPN gateways.",
  rungs: [
    ["Vendor advisory and security press coverage.", [{ label: "Ivanti security advisory", url: "https://forums.ivanti.com/s/security-advisories", at: "2026-10-14" }]],
    ["VPN gateways face the internet by design.", [{ label: "Ivanti security advisory", url: "https://forums.ivanti.com/s/security-advisories", at: "2026-10-14" }]],
    ["Attack attempts reported by security firms.", [{ label: "Security vendor reports", at: "2026-10-15" }]],
    kevRung("CISA added the flaw to its exploited list."),
    noDamage(),
  ],
  facts: [
    { label: "HIGHEST CONFIRMED RUNG", value: "EXPLOITED" },
    { label: "CISA KEV", value: "LISTED" },
  ],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-14T15:00:00Z",
  sources: [CISA_KEV],
});

const paloalto = build({
  id: "palo-alto-pan-os",
  title: "Palo Alto PAN-OS",
  cves: ["CVE-2026-0322"],
  idsLabel: "CVE-2026-0322",
  verdict: "act_now",
  ladder: "ccccn",
  exposure: "Firewalls. Exposure depends on which features are on.",
  question: "Are firewall management interfaces reachable from the internet?",
  summary: "A flaw in the PAN-OS firewall operating system is on the exploited list. Risk depends on which features are turned on.",
  verdictReason: "Confirmed exploitation on firewalls. Exposure varies by configuration.",
  rungs: [
    ["Vendor advisory and security press coverage.", [{ label: "Palo Alto Networks advisory", url: "https://security.paloaltonetworks.com/", at: "2026-10-12" }]],
    ["Exposure depends on enabled features, mainly management and remote access interfaces.", [{ label: "Palo Alto Networks advisory", url: "https://security.paloaltonetworks.com/", at: "2026-10-12" }]],
    ["Attack attempts reported by security firms.", [{ label: "Security vendor reports", at: "2026-10-13" }]],
    kevRung("CISA added the flaw to its exploited list."),
    noDamage(),
  ],
  facts: [
    { label: "HIGHEST CONFIRMED RUNG", value: "EXPLOITED" },
    { label: "CISA KEV", value: "LISTED" },
  ],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-12T15:00:00Z",
  sources: [CISA_KEV],
});

const atlassian = build({
  id: "atlassian-file-exposure",
  title: "Atlassian file exposure",
  cves: ["CVE-2026-21589"],
  idsLabel: "CVE-2026-21589",
  verdict: "watch",
  ladder: "cpcnn",
  exposure: "Self-hosted Jira and Confluence. Cloud versions are vendor-managed.",
  question: "Do we still self-host any Atlassian products?",
  summary: "A flaw in self-hosted Atlassian products can expose files. Attack attempts are confirmed. Exploitation is not.",
  verdictReason: "Attempts confirmed, exploitation not confirmed, and cloud customers are not affected.",
  rungs: [
    ["Vendor advisory and security press coverage.", [{ label: "Atlassian security bulletin", url: "https://www.atlassian.com/trust/security/advisories", at: "2026-10-15" }]],
    ["Self-hosted versions only. The number exposed to the internet is not yet published.", [{ label: "Atlassian security bulletin", url: "https://www.atlassian.com/trust/security/advisories", at: "2026-10-15" }]],
    ["Scanning and attack attempts reported by more than one source.", [{ label: "Security vendor reports", at: "2026-10-17" }]],
    ["Not on the CISA KEV list. No confirmed exploitation.", [{ label: "CISA", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", at: "2026-10-23" }]],
    noDamage(),
  ],
  facts: [{ label: "HIGHEST CONFIRMED RUNG", value: "TRIED" }, { label: "CISA KEV", value: "NOT YET" }],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-15T15:00:00Z",
  sources: [{ label: "Atlassian security bulletin", url: "https://www.atlassian.com/trust/security/advisories", at: "2026-10-15" }],
});

const phpNew = build({
  id: "php-unpatched-flaw",
  title: "New unpatched PHP flaw",
  cves: ["CVE-2026-115560"],
  idsLabel: "CVE-2026-115560",
  verdict: "watch",
  ladder: "cpnnn",
  exposure: "PHP servers. Details not yet public.",
  question: "Is our PHP owner tracking this for a second emergency patch?",
  summary: "A new PHP flaw has been reported. No fix exists and details are not public.",
  verdictReason: "Talk is confirmed. Exposure is reported. No attempts or exploitation are known.",
  rungs: [
    ["Researchers and the PHP project have discussed the flaw publicly.", [{ label: "PHP project discussion", url: "https://www.php.net/", at: "2026-10-22" }]],
    ["Reported to affect supported PHP versions. Details not yet public, so the scope is unconfirmed.", [{ label: "Security press", at: "2026-10-22" }]],
    ["No attempts reported.", []],
    ["Not on the CISA KEV list.", [{ label: "CISA", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", at: "2026-10-23" }]],
    ["No public reports of a breach.", []],
  ],
  facts: [{ label: "HIGHEST CONFIRMED RUNG", value: "TALK" }, { label: "FIX AVAILABLE", value: "NO" }],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-22T15:00:00Z",
  sources: [{ label: "PHP project discussion", url: "https://www.php.net/", at: "2026-10-22" }],
});

const plex = build({
  id: "plex-media-server",
  title: "Plex Media Server",
  cves: [],
  idsLabel: "4 CVEs added Oct 20",
  verdict: "low",
  ladder: "cpccn",
  exposure: "Consumer media servers. Matters on home machines used for work.",
  question: "Do engineers with production access work from shared home machines?",
  summary: "Four Plex Media Server flaws were added to the exploited list. The product is mostly used at home.",
  verdictReason: "Exploitation is confirmed, but few business systems run this product.",
  rungs: [
    ["Vendor advisory and security press coverage.", [{ label: "Plex security notice", url: "https://www.plex.tv/", at: "2026-10-19" }]],
    ["Consumer media servers. Business exposure is limited to home machines used for work.", [{ label: "Plex security notice", url: "https://www.plex.tv/", at: "2026-10-19" }]],
    ["Attack attempts reported by security firms.", [{ label: "Security vendor reports", at: "2026-10-20" }]],
    kevRung("CISA added four flaws to its exploited list on Oct 20."),
    noDamage(),
  ],
  facts: [{ label: "HIGHEST CONFIRMED RUNG", value: "EXPLOITED" }, { label: "CISA KEV", value: "LISTED" }],
  updatedAt: "2026-10-23T17:40:00Z",
  trackingSince: "2026-10-19T15:00:00Z",
  sources: [CISA_KEV],
});

export const SAMPLE_EVENTS: EventView[] = [php2shell, citrix, beyondtrust, ivanti, paloalto, atlassian, phpNew, plex];
