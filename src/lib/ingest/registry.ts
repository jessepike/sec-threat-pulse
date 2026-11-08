import type { SourceAdapter } from "@/lib/ladder/types";
import { cisaKevAdapter } from "./adapters/cisa-kev";
import { vulncheckKevAdapter } from "./adapters/vulncheck-kev";
import { msrcAdapter } from "./adapters/msrc";
import { epssAdapter } from "./adapters/epss";
import { cvelistAdapter } from "./adapters/cvelist";
import { nvdAdapter } from "./adapters/nvd";
import { circlSightingsAdapter } from "./adapters/circl-sightings";
import { metasploitAdapter } from "./adapters/metasploit";
import { nucleiAdapter } from "./adapters/nuclei";
import { pocGithubAdapter } from "./adapters/poc-github";
import { exploitdbAdapter } from "./adapters/exploitdb";
import { sec8kAdapter } from "./adapters/sec-8k";
import { hibpAdapter } from "./adapters/hibp";
import { waAgAdapter } from "./adapters/wa-ag";
import { caAgAdapter } from "./adapters/ca-ag";
import { ADVISORY_FEEDS, FEED_HOMEPAGES, NEWS_FEEDS, makeFeedAdapter } from "./adapters/feeds";

export type TermsStatus = "open" | "attribution" | "approval_needed" | "blocked" | "unclear";

export interface SourceDefinition {
  adapter: SourceAdapter;
  category: string;
  homepage: string;
  termsStatus: TermsStatus;
  /** Text shown on the site where this source is credited. */
  attribution?: string;
  /** Env vars the adapter needs to run. */
  requiresEnv?: string[];
}

/**
 * Order matters: sources that define tracked CVEs (KEV) run before sources that look them up.
 */
export const SOURCE_REGISTRY: SourceDefinition[] = [
  { adapter: cisaKevAdapter, category: "kev", homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", termsStatus: "open", attribution: "CISA Known Exploited Vulnerabilities Catalog (CC0)" },
  { adapter: vulncheckKevAdapter, category: "kev", homepage: "https://vulncheck.com/kev", termsStatus: "attribution", attribution: "VulnCheck KEV", requiresEnv: ["VULNCHECK_API_TOKEN"] },
  { adapter: msrcAdapter, category: "vendor", homepage: "https://msrc.microsoft.com/update-guide", termsStatus: "attribution", attribution: "Microsoft Security Response Center security update guide" },
  { adapter: nvdAdapter, category: "cve-record", homepage: "https://nvd.nist.gov/", termsStatus: "attribution", attribution: "This product uses the NVD API but is not endorsed or certified by the NVD." },
  { adapter: cvelistAdapter, category: "cve-record", homepage: "https://github.com/CVEProject/cvelistV5", termsStatus: "open", attribution: "CVE List V5 (CVE Program) and CISA Vulnrichment (CC0)" },
  { adapter: epssAdapter, category: "forecast", homepage: "https://www.first.org/epss/", termsStatus: "attribution", attribution: "EPSS scores by FIRST (first.org/epss)" },
  { adapter: circlSightingsAdapter, category: "sighting", homepage: "https://vulnerability.circl.lu/", termsStatus: "unclear", attribution: "Sightings from CIRCL Vulnerability-Lookup" },
  { adapter: metasploitAdapter, category: "exploit", homepage: "https://github.com/rapid7/metasploit-framework", termsStatus: "open", attribution: "Metasploit Framework module metadata (BSD-3-Clause, Rapid7)" },
  { adapter: nucleiAdapter, category: "exploit", homepage: "https://github.com/projectdiscovery/nuclei-templates", termsStatus: "open", attribution: "nuclei-templates (MIT, ProjectDiscovery)" },
  { adapter: pocGithubAdapter, category: "exploit", homepage: "https://github.com/nomi-sec/PoC-in-GitHub", termsStatus: "open", attribution: "PoC-in-GitHub (CC0, nomi-sec)" },
  { adapter: exploitdbAdapter, category: "exploit", homepage: "https://www.exploit-db.com/", termsStatus: "attribution", attribution: "Exploit-DB (OffSec), metadata and links only" },
  { adapter: sec8kAdapter, category: "damage", homepage: "https://www.sec.gov/edgar/search/", termsStatus: "open", attribution: "SEC EDGAR, Form 8-K Item 1.05" },
  { adapter: hibpAdapter, category: "damage", homepage: "https://haveibeenpwned.com/", termsStatus: "attribution", attribution: "Breach data from Have I Been Pwned (haveibeenpwned.com), CC BY 4.0" },
  { adapter: waAgAdapter, category: "damage", homepage: "https://www.atg.wa.gov/data-breach-notifications", termsStatus: "attribution", attribution: "Data breach notices from the Washington State Attorney General's Office" },
  { adapter: caAgAdapter, category: "damage", homepage: "https://oag.ca.gov/privacy/databreach/list", termsStatus: "open", attribution: "Data breach notices filed with the California Attorney General" },
  ...NEWS_FEEDS.map((f) => ({
    adapter: makeFeedAdapter(f),
    category: "news",
    homepage: FEED_HOMEPAGES[f.id],
    termsStatus: "attribution" as const,
    attribution: `Headlines and links from ${f.name}`,
  })),
  ...ADVISORY_FEEDS.map((f) => ({
    adapter: makeFeedAdapter(f),
    category: "advisory",
    homepage: FEED_HOMEPAGES[f.id],
    termsStatus: "attribution" as const,
    attribution: `Advisory headlines and links from ${f.name}`,
  })),
];

export const ADAPTERS: SourceAdapter[] = SOURCE_REGISTRY.map((d) => d.adapter);

export function getDefinition(id: string): SourceDefinition | undefined {
  return SOURCE_REGISTRY.find((d) => d.adapter.id === id);
}
