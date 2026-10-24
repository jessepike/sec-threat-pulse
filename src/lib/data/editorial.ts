import type { BriefData, DoItem, DriverBar, KpiView, NoiseItem, RealItem, StatView } from "./types";

/**
 * Hand-written copy that the pipeline does not generate yet. It is shown in sample mode and,
 * where marked, in live mode. Replace with generated or admin-edited content in a later phase.
 */

export const SAMPLE_WEEK_OF = "Oct 19, 2026";

export const SAMPLE_HERO_BLURB =
  "Attacks are getting faster. One flaw needs action this week: critical bugs in PHP, the software behind most websites. Attackers tried it before the fix existed. No breaches confirmed yet.";

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
  { lead: "List what you expose to the internet,", text: "including systems run by vendors and hosts for you." },
  { lead: "Check the Act now events below against that list.", text: "Any match is a same-day patch or a decision to isolate." },
  { lead: "Look back to the first known attempt.", text: "Review logs from that date, not from the patch date." },
];

export const SAMPLE_COUNTS_NOTE = "Most \"act now\" items are edge and remote access systems.";

/** Report-based figures. Each cites its published source. Shown in both modes. */
export const REPORT_KPIS: KpiView[] = [
  { label: "DISCLOSURE TO EXPLOITATION", value: "80d", delta: "▼ WAS 120", deltaTone: "crit", meaning: "Median for 2026. The urgent ones move in days.", source: "VULNCHECK H1 2026" },
  { label: "TIME TO WORKING EXPLOIT", value: "24h", delta: "▼ WAS 72", deltaTone: "crit", meaning: "Once a flaw is public, assume attackers can use it the next day.", source: "RECORDED FUTURE" },
  { label: "AI-FOUND BUGS EXPLOITED", value: "1.3%", delta: "= BASELINE", deltaTone: "ok", meaning: "AI finds more bugs. That does not make them more likely to be used.", source: "VULNCHECK H1 2026" },
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
    { lead: "AI finds bugs faster on both sides.", text: "Defenders fix more of their own flaws. Attackers turn published flaws into working attacks faster: about 24 hours, down from about 72." },
    { lead: "Most new bugs never get used.", text: "Attackers still pick a small set: edge devices, remote access and widely used web software." },
    { lead: "Patching is the bottleneck.", text: "Exploited flaws are now the top cause of breaches, and the median time to fully fix one rose to 43 days." },
  ],
  barsTitle: "Twice the bugs. Barely more exploitation. Less time.",
  barsCaption: "FOUND VS USED · 2026 VS 2025 · INDEX 2025 = 100",
  bars: [
    { label: "VULNS DISCLOSED", value: "~200", pct: 100, tone: "accent" },
    { label: "KNOWN EXPLOITED", value: "110", pct: 55, tone: "warn" },
    { label: "DAYS TO EXPLOITATION", value: "67", pct: 33, tone: "crit" },
  ] as DriverBar[],
  barsSource: "SRC: NVD VIA BLOOMBERG · VULNCHECK H1 2026",
};

/** `needsApproval` items are hidden in live mode until the source terms allow use. */
export const RANSOMWARE: (StatView & { needsApproval?: boolean })[] = [
  { value: "3,600+", text: "Claimed victims in 2026", source: "RANSOMWARE.LIVE", needsApproval: true },
  { value: "91", text: "Active leak sites in Q1, a record", source: "RELIAQUEST" },
  { value: "GENTLEMEN", text: "Overtook Qilin as most active group in June", source: "CHECK POINT" },
  { value: "EDGE", text: "Unpatched internet-facing systems remain the main way in", source: "BREACHSENSE" },
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
