import type { BriefData, DoItem, DriverBar, DriverParagraph, KpiView, NoiseItem, RealItem, SourceLink, StatView } from "./types";

/**
 * Hand-written copy that the pipeline does not generate yet. It is shown in sample mode and,
 * where marked, in live mode. Replace with generated or admin-edited content in a later phase.
 */

export const SAMPLE_WEEK_OF = "Oct 19, 2026";

export const SAMPLE_REAL: RealItem[] = [
  { title: "PHP2Shell is being tried in the wild", text: "Probed four days before a patch existed. Hits nearly every PHP web server." },
  { title: "Citrix NetScaler zero-days confirmed", text: "CISA confirms global exploitation. Two flaws each allow remote takeover." },
  { title: "Remote access keeps getting hit", text: "BeyondTrust, Ivanti and Palo Alto were all added to the exploited list in 10 days." },
];

export const NOISE: NoiseItem[] = [
  { title: "\"AI set off an exploit wave\"", tag: "DEBUNKED", text: "AI doubled bugs found. Only 1.3% of AI-found bugs were exploited, the same rate as everything else." },
  { title: "\"PHP2Shell is a CVSS 10\"", tag: "OVERSTATED", text: "That score came from the leak. PHP's official score is 9.2. Still critical." },
  { title: "Leak-site victim counts", tag: "UNVERIFIED", text: "Criminal claims, and some are fake. They show activity but prove no breach." },
];

export const ACTIONS: DoItem[] = [
  { lead: "Find every PHP server you own or rent,", text: "including vendor appliances and hosted sites. Patch or take offline." },
  { lead: "Check this week's exploited list against your edge.", text: "Citrix, BeyondTrust, Ivanti, Palo Alto. Any match is a same-day patch." },
  { lead: "Look back to Oct 17, the first known attempt.", text: "Review PHP server logs from that date, not from the patch date." },
];

export const LIVE_ACTIONS: DoItem[] = [
  { lead: "Pick the vendors you use", text: "in the list below, so you only see what applies to you." },
  { lead: "For each Act now match, patch today.", text: "If you cannot, cut it off from the internet until you can." },
  { lead: "Not the one who patches?", text: "Send the event page to your IT provider or security lead and ask: are we affected, and when will it be fixed?" },
];

export const SAMPLE_COUNTS_NOTE = "Most \"act now\" items are edge and remote access systems.";

/** Report-based figures. Each cites its published source. Shown in both modes. */
export const REPORT_KPIS: KpiView[] = [
  { label: "DISCLOSURE TO EXPLOITATION", value: "80d", delta: "▼ WAS 120", deltaTone: "crit", meaning: "Median days from a flaw going public to known use in attacks, first half of 2026.", source: "VULNCHECK 1H 2026", sourceUrl: "https://www.vulncheck.com/blog/state-of-exploitation-1h-2026", asOf: "2026-07-28" },
  { label: "EXPLOITED BY DAY ONE", value: "23%", delta: "▼ WAS 29%", deltaTone: "ok", meaning: "Share of exploited flaws attacked on or before the day they were published.", source: "VULNCHECK 1H 2026", sourceUrl: "https://www.vulncheck.com/blog/state-of-exploitation-1h-2026", asOf: "2026-07-28" },
  { label: "AI-FOUND BUGS EXPLOITED", value: "1.3%", delta: "= BASELINE", deltaTone: "ok", meaning: "14 of 1,061 AI-found flaws. About the same rate as all flaws.", source: "VULNCHECK 1H 2026", sourceUrl: "https://www.vulncheck.com/blog/state-of-exploitation-1h-2026", asOf: "2026-07-28" },
];

export const SAMPLE_KEV_KPI: KpiView = {
  label: "NEW CONFIRMED EXPLOITED · 7D",
  value: "13",
  delta: "▲ 38 IN 30D",
  deltaTone: "crit",
  meaning: "Flaws CISA confirmed are used in real attacks.",
  source: "CISA KEV",
};

export const DRIVERS = {
  paragraphs: [
    {
      lead: "AI is finding more bugs.",
      text: "Flaws logged in the US vulnerability database in 2026 are on pace to double 2025. The share used in attacks has not risen with them.",
      src: { label: "Bloomberg Law, Jul 27, 2026", url: "https://news.bloomberglaw.com/tech-and-telecom-law/ai-finding-twice-as-many-cyber-flaws-in-2026-as-it-did-in-2025" },
    },
    {
      lead: "Attackers move sooner.",
      text: "The median time from a flaw going public to known use in attacks fell to 80 days, from 120. About 1 in 4 exploited flaws is attacked by the day it is published.",
      src: { label: "VulnCheck, Jul 28, 2026", url: "https://www.vulncheck.com/blog/state-of-exploitation-1h-2026" },
    },
    {
      lead: "Exploited flaws are now the top way in.",
      text: "They started 36% of breaches in 2026, ahead of stolen passwords.",
      src: { label: "Verizon DBIR 2026 via CXO Digital Pulse, May 20, 2026", url: "https://www.cxodigitalpulse.com/verizon-dbir-2026-vulnerability-exploitation-becomes-the-leading-cause-of-data-breaches/" },
    },
  ] as DriverParagraph[],
  barsTitle: "Twice the bugs. Barely more exploitation. Less time.",
  barsCaption: "FOUND VS USED · INDEX: PRIOR PERIOD = 100",
  bars: [
    { label: "FLAWS LOGGED · 2026 PACE VS 2025", value: "~200", pct: 100, tone: "accent" },
    { label: "NEWLY EXPLOITED · 1H 2026 VS 2H 2025", value: "110", pct: 55, tone: "warn" },
    { label: "DAYS TO EXPLOITATION · 1H 2026 VS 2025", value: "67", pct: 33, tone: "crit" },
  ] as DriverBar[],
  barsSources: [
    { label: "Bloomberg Law (NVD), Jul 27, 2026", url: "https://news.bloomberglaw.com/tech-and-telecom-law/ai-finding-twice-as-many-cyber-flaws-in-2026-as-it-did-in-2025" },
    { label: "VulnCheck 1H 2026, Jul 28, 2026", url: "https://www.vulncheck.com/blog/state-of-exploitation-1h-2026" },
  ] as SourceLink[],
};

/** `needsApproval` items are hidden in live mode until the source terms allow use. */
export const RANSOMWARE: (StatView & { needsApproval?: boolean })[] = [
  { value: "3,600+", text: "Claimed victims in 2026", source: "RANSOMWARE.LIVE", needsApproval: true },
  {
    value: "91",
    text: "Active leak sites in Q1 2026, above the previous peak of 84",
    source: "RELIAQUEST VIA SECURITYBRIEF",
    sourceUrl: "https://securitybrief.news/story/ransomware-posts-rise-22-as-leak-sites-proliferate",
    asOf: "2026-04-29",
  },
  {
    value: "GENTLEMEN",
    text: "Overtook Qilin as the most active group in June, with 17% of posted attacks",
    source: "CHECK POINT VIA ITPRO",
    sourceUrl: "https://www.itpro.com/security/ransomware/this-one-cyber-crime-group-accounted-for-nearly-a-fifth-of-all-ransomware-attacks-in-june",
    asOf: "2026-07-13",
  },
];

export const BRIEF_STATIC = {
  notConcern:
    "Reports that AI set off a wave of attacks. AI doubled the flaws found, but the share used in attacks has not changed. Ransomware leak-site counts are criminal claims, and some are fake.",
  questions: [
    "How long does it take us to patch a critical internet-facing flaw?",
    "Do we know every system we expose to the internet, including vendor-run ones?",
    "Who decides to take a system offline if it cannot be patched?",
  ],
  position: [
    { item: "Internet-facing PHP servers patched", status: "[STATUS]", note: "[PATCHED / TOTAL]" },
    { item: "This week's exploited products in use", status: "[STATUS]", note: "[WHICH, IF ANY]" },
    { item: "Signs of compromise found", status: "[STATUS]", note: "[REVIEW WINDOW]" },
    { item: "Time to patch a critical edge flaw", status: "[DAYS]", note: "[TARGET]" },
  ],
  sourcesLine: "SRC: CISA KEV · VULNCHECK · RECORDED FUTURE · PHP ADVISORY · AMAZON TI · WATCHTOWR",
};

/** The live brief's blanks and sources. The sample's PHP rows and named vendors describe sample data only. */
export const LIVE_BRIEF_STATIC = {
  position: [
    { item: "This week's Act now products in use", status: "[STATUS]", note: "[WHICH, IF ANY]" },
    { item: "Those systems patched or isolated", status: "[STATUS]", note: "[PATCHED / TOTAL]" },
    { item: "Signs of compromise found", status: "[STATUS]", note: "[REVIEW WINDOW]" },
    { item: "Time to patch a critical edge flaw", status: "[DAYS]", note: "[TARGET]" },
  ],
  sourcesLine: "SRC: CISA KEV · CVE PROGRAM · NVD · FIRST EPSS · CIRCL · SECURITY NEWS AND ADVISORIES · VULNCHECK 1H 2026",
};

export const SAMPLE_BRIEF: Pick<BriefData, "bottomLine" | "changes"> = {
  bottomLine:
    "Threat level is elevated but not unusual. One widespread flaw needs fast patching. AI volume headlines overstate the risk.",
  changes: [
    { lead: "PHP2Shell.", text: "Critical flaws in the software behind most websites. Attack attempts seen; no confirmed breaches yet. Fix released Oct 21." },
    { lead: "Remote access under attack.", text: "CISA confirmed 13 newly exploited flaws in 7 days, mostly VPN, firewall and remote support products." },
    { lead: "Attackers move faster.", text: "Working attacks now appear about a day after a flaw is published, down from about three days last year." },
  ],
};

export const LIVE_BOTTOM_LINE =
  "This brief lists the events with the strongest evidence this week. Each sits on a five-step evidence ladder.";
