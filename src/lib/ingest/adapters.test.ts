import { describe, expect, it } from "vitest";
import type { AdapterContext } from "@/lib/ladder/types";
import { fakeFetch, fixture, noSleep } from "./testing";
import { cisaKevAdapter } from "./adapters/cisa-kev";
import { vulncheckKevAdapter } from "./adapters/vulncheck-kev";
import { epssAdapter } from "./adapters/epss";
import { cvelistAdapter, cvePath, parseCveRecord } from "./adapters/cvelist";
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
import { SOURCE_REGISTRY } from "./registry";

const now = new Date("2026-10-24T18:00:00Z");
const ctx = (f: typeof fetch, extra: Partial<AdapterContext> = {}): AdapterContext => ({ fetch: f, now, sleep: noSleep, ...extra });
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe("registry", () => {
  it("has one definition per P1 source with metadata", () => {
    const ids = SOURCE_REGISTRY.map((d) => d.adapter.id);
    expect(ids).toEqual(["cisa-kev", "vulncheck-kev", "nvd", "cvelist", "epss", "circl-sightings", "metasploit", "nuclei", "poc-github", "exploitdb", "sec-8k", "hibp", "wa-ag", "ca-ag"]);
    for (const d of SOURCE_REGISTRY) {
      expect(d.homepage).toMatch(/^https:/);
      expect(d.attribution).toBeTruthy();
      expect(d.adapter.intervalMinutes).toBeGreaterThan(0);
    }
  });
});

describe("cisa-kev", () => {
  const f = () => fakeFetch([["known_exploited_vulnerabilities.json", fixture("cisa-kev.json")]]);

  it("maps entries to confirmed exploited observations and vulnerability facts", async () => {
    const r = await cisaKevAdapter.run(ctx(f().fetch));
    expect(r.observations).toHaveLength(11);
    expect(unique(r.observations.map((o) => o.dedupeKey))).toBe(true);
    const o = r.observations[0];
    expect(o).toMatchObject({ sourceId: "cisa-kev", kind: "exploited", strength: "confirmed", dedupeKey: "cisa-kev:CVE-2026-114625", vendor: "Arista" });
    expect(o.url).toContain("CVE-2026-114625");
    expect(o.publishedAt).toBe("2026-10-23T00:00:00.000Z");
    const v = r.vulnerabilities.find((x) => x.cveId === "CVE-2021-44228")!;
    expect(v.kevCisaDateAdded).toBe("2021-12-10");
    expect(v.kevCisaRansomware).toBe(true);
    expect(r.vulnerabilities[0].kevCisaRansomware).toBe(false);
    expect(r.vulnerabilities[0].cwe).toEqual(["CWE-89"]);
    expect(r.cursor).toBe("2026.10.23");
    expect(r.raw?.body).toBeTruthy();
  });

  it("skips when the catalog version is unchanged", async () => {
    const r = await cisaKevAdapter.run(ctx(f().fetch, { cursor: "2026.10.23" }));
    expect(r.observations).toHaveLength(0);
  });

  it("falls back to the mirror", async () => {
    const ff = fakeFetch([
      ["cisa.gov", { status: 403 }],
      ["raw.githubusercontent.com/cisagov", fixture("cisa-kev.json")],
    ]);
    const r = await cisaKevAdapter.run(ctx(ff.fetch));
    expect(r.observations.length).toBeGreaterThan(0);
  });

  it("rejects a payload with no vulnerabilities", async () => {
    await expect(cisaKevAdapter.run(ctx(fakeFetch([["cisa.gov", "{}"]]).fetch))).rejects.toThrow();
  });
});

describe("vulncheck-kev", () => {
  // The recorded shape is synthetic: no API token was available to capture a live response.
  const payload = {
    _meta: { next_cursor: null },
    data: [
      {
        vendorProject: "Example",
        product: "Edge Gateway",
        vulnerabilityName: "Example Edge Gateway RCE",
        shortDescription: "Remote code execution.",
        knownRansomwareCampaignUse: "Known",
        cve: ["CVE-2026-0001", "CVE-2026-0002"],
        date_added: "2026-10-20T00:00:00Z",
        vulncheck_reported_exploitation: [{ url: "https://example.com/report", date_added: "2026-10-20" }],
        vulncheck_xdb: [{ xdb_url: "https://vulncheck.com/xdb/abc" }],
      },
    ],
  };

  it("skips cleanly without a token", async () => {
    const f = fakeFetch([]);
    const r = await vulncheckKevAdapter.run(ctx(f.fetch, { env: {} }));
    expect(r.skipped).toMatch(/VULNCHECK_API_TOKEN/);
    expect(f.calls).toHaveLength(0);
  });

  it("maps entries and sends the bearer token", async () => {
    const f = fakeFetch([["api.vulncheck.com", JSON.stringify(payload)]]);
    const r = await vulncheckKevAdapter.run(ctx(f.fetch, { env: { VULNCHECK_API_TOKEN: "tok" } }));
    expect(f.calls[0].headers.Authorization).toBe("Bearer tok");
    expect(r.observations.map((o) => o.dedupeKey)).toEqual(["vulncheck-kev:CVE-2026-0001", "vulncheck-kev:CVE-2026-0002"]);
    expect(r.observations[0]).toMatchObject({ kind: "exploited", strength: "confirmed" });
    expect(r.vulnerabilities[0]).toMatchObject({ kevVulncheckDateAdded: "2026-10-20", kevCisaRansomware: true });
  });

  it("follows the page cursor", async () => {
    const f = fakeFetch([
      [/cursor=next1/, JSON.stringify({ _meta: { next_cursor: null }, data: [{ ...payload.data[0], cve: ["CVE-2026-0003"] }] })],
      ["start_cursor", JSON.stringify({ _meta: { next_cursor: "next1" }, data: payload.data })],
    ]);
    const r = await vulncheckKevAdapter.run(ctx(f.fetch, { env: { VULNCHECK_API_TOKEN: "tok" } }));
    expect(r.observations).toHaveLength(3);
  });
});

describe("epss", () => {
  it("scores tracked CVEs in batches and emits no observations", async () => {
    const f = fakeFetch([["api.first.org", fixture("epss.json")]]);
    const r = await epssAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228", "CVE-2023-4966"] }));
    expect(r.observations).toHaveLength(0);
    expect(r.vulnerabilities).toHaveLength(2);
    expect(r.vulnerabilities[1]).toMatchObject({ cveId: "CVE-2021-44228", epss: 0.99999, epssDate: "2026-10-24" });
    expect(f.calls[0].url).toContain("cve=CVE-2021-44228,CVE-2023-4966");
  });

  it("batches at 100", async () => {
    const f = fakeFetch([["api.first.org", '{"data":[]}']]);
    const cves = Array.from({ length: 230 }, (_, i) => `CVE-2026-${1000 + i}`);
    await epssAdapter.run(ctx(f.fetch, { trackedCves: cves }));
    expect(f.calls).toHaveLength(3);
  });
});

describe("cvelist", () => {
  const record = JSON.parse(fixture("cvelist-CVE-2021-44228.json"));

  it("builds the per-CVE path", () => {
    expect(cvePath("CVE-2021-44228")).toBe("2021/44xxx/CVE-2021-44228.json");
    expect(cvePath("CVE-2026-0322")).toBe("2026/0xxx/CVE-2026-0322.json");
    expect(cvePath("CVE-2026-114625")).toBe("2026/114xxx/CVE-2026-114625.json");
  });

  it("reads ADP SSVC Exploitation active as confirmed exploitation", () => {
    const { observations, vulnerability } = parseCveRecord("CVE-2021-44228", record);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ kind: "exploited", strength: "confirmed", dedupeKey: "cvelist-ssvc:CVE-2021-44228:active" });
    expect(vulnerability.cvssScore).toBe(10);
    expect(vulnerability.vendor).toBe("Apache Software Foundation");
    expect(vulnerability.cwe?.length).toBeGreaterThan(0);
    expect(vulnerability.publishedAt).toBe("2021-12-10T00:00:00.000Z");
  });

  it("maps poc to exploit_available and none to nothing", () => {
    const poc = structuredClone(record);
    const ssvc = poc.containers.adp.flatMap((a: { metrics?: unknown[] }) => a.metrics ?? []).find((m: { other?: { type?: string } }) => m.other?.type === "ssvc");
    ssvc.other.content.options[0] = { Exploitation: "poc" };
    const p = parseCveRecord("CVE-2021-44228", poc);
    expect(p.observations[0]).toMatchObject({ kind: "exploit_available", metadata: { maturity: "poc" } });
    expect(p.vulnerability.exploitMaturity).toBe("poc");
    ssvc.other.content.options[0] = { Exploitation: "none" };
    expect(parseCveRecord("CVE-2021-44228", poc).observations).toHaveLength(0);
  });

  it("fetches tracked CVEs and tolerates 404", async () => {
    const f = fakeFetch([["CVE-2021-44228.json", fixture("cvelist-CVE-2021-44228.json")]]);
    const r = await cvelistAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228", "CVE-2026-999999"] }));
    expect(r.observations).toHaveLength(1);
    expect(r.vulnerabilities).toHaveLength(1);
    expect(f.calls).toHaveLength(2);
  });
});

describe("nvd", () => {
  const body = fixture("nvd-CVE-2021-44228.json");

  it("enriches CVEs by id and filters the modified window to tracked CVEs", async () => {
    const f = fakeFetch([["services.nvd.nist.gov", body]]);
    const r = await nvdAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228"], enrichCves: ["CVE-2021-44228"], env: {} }));
    expect(f.calls[0].url).toContain("cveId=CVE-2021-44228");
    expect(f.calls[1].url).toContain("lastModStartDate=2026-10-23T18:00:00.000");
    expect(r.observations).toHaveLength(0);
    expect(r.vulnerabilities).toHaveLength(1);
    expect(r.vulnerabilities[0]).toMatchObject({ cveId: "CVE-2021-44228", cvssScore: 10 });
    expect(r.vulnerabilities[0].description).toContain("Log4j");
    expect(r.cursor).toBe(now.toISOString());
  });

  it("ignores window results for untracked CVEs and sends the API key", async () => {
    const f = fakeFetch([["services.nvd.nist.gov", body]]);
    const r = await nvdAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2000-0001"], env: { NVD_API_KEY: "k" } }));
    expect(r.vulnerabilities).toHaveLength(0);
    expect(f.calls[0].headers.apiKey).toBe("k");
  });
});

describe("circl-sightings", () => {
  const routes = (): ReturnType<typeof fakeFetch> =>
    fakeFetch([
      ["type=exploited", fixture("circl-exploited.json")],
      ["type=published-proof-of-concept", fixture("circl-published-proof-of-concept.json")],
      ["type=confirmed", fixture("circl-confirmed.json")],
      ["type=seen", fixture("circl-seen.json")],
    ]);

  it("maps sighting types without storing sighting text", async () => {
    const r = await circlSightingsAdapter.run(ctx(routes().fetch));
    const kinds = new Set(r.observations.map((o) => o.kind));
    expect(kinds).toEqual(new Set(["exploited", "exploit_available", "talk"]));
    const ex = r.observations.find((o) => o.kind === "exploited")!;
    expect(ex.strength).toBe("reported");
    expect(ex.dedupeKey).toMatch(/^circl:[0-9a-f-]{36}$/);
    expect(r.observations.every((o) => !o.summary)).toBe(true);
    expect(unique(r.observations.map((o) => o.dedupeKey))).toBe(true);
    expect(r.vulnerabilities.every((v) => v.exploitMaturity === "poc")).toBe(true);
    expect(Object.keys(JSON.parse(r.cursor!)).sort()).toEqual(["confirmed", "exploited", "published-proof-of-concept", "seen"]);
  });

  it("keeps non-exploited sightings only for tracked CVEs", async () => {
    const r = await circlSightingsAdapter.run(ctx(routes().fetch, { trackedCves: ["CVE-1999-0001"] }));
    expect(r.observations.every((o) => o.kind === "exploited")).toBe(true);
  });

  it("stops at the cursor", async () => {
    const first = await circlSightingsAdapter.run(ctx(routes().fetch));
    const second = await circlSightingsAdapter.run(ctx(routes().fetch, { cursor: first.cursor }));
    expect(second.observations).toHaveLength(0);
  });
});

describe("metasploit", () => {
  const url = "metasploit-framework/master/db/modules_metadata_base.json";

  it("emits weaponized observations for tracked CVEs", async () => {
    const f = fakeFetch([[url, { body: fixture("metasploit.json"), headers: { etag: '"e1"' } }]]);
    const r = await metasploitAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228"] }));
    const log4 = r.observations.filter((o) => o.cveIds.includes("CVE-2021-44228"));
    expect(log4.length).toBeGreaterThanOrEqual(3);
    expect(log4[0]).toMatchObject({ kind: "exploit_available", strength: "confirmed", metadata: { maturity: "weaponized" } });
    expect(log4[0].url).toContain("github.com/rapid7/metasploit-framework/blob/master/modules/exploits/");
    expect(r.vulnerabilities.find((v) => v.cveId === "CVE-2021-44228")?.exploitMaturity).toBe("weaponized");
    expect(r.cursor).toMatch(/^"e1"\|/);
  });

  it("caps the untracked modules", async () => {
    const f = fakeFetch([[url, fixture("metasploit.json")]]);
    const all = await metasploitAdapter.run(ctx(f.fetch, { trackedCves: [] }));
    expect(all.observations.length).toBeLessThanOrEqual(30);
    expect(all.observations.length).toBeGreaterThan(0);
  });

  it("does nothing when the file and tracked set are unchanged", async () => {
    const f = fakeFetch([[url, { body: fixture("metasploit.json"), headers: { etag: '"e1"' } }]]);
    const first = await metasploitAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228"] }));
    const again = await metasploitAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228"], cursor: first.cursor }));
    expect(again.observations).toHaveLength(0);
    expect(f.calls[1].headers["If-None-Match"]).toBe('"e1"');
    const changed = await metasploitAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228", "CVE-2020-0001"], cursor: first.cursor }));
    expect(changed.observations.length).toBeGreaterThan(0);
  });
});

describe("nuclei", () => {
  it("emits weaponized observations for tracked and newest CVEs", async () => {
    const f = fakeFetch([["nuclei-templates/main/cves.json", fixture("nuclei.jsonl")]]);
    const r = await nucleiAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228"] }));
    const o = r.observations.find((x) => x.dedupeKey === "nuclei:CVE-2021-44228")!;
    expect(o).toMatchObject({ kind: "exploit_available", strength: "confirmed", metadata: { maturity: "weaponized" } });
    expect(o.url).toContain("projectdiscovery/nuclei-templates/blob/main/");
    expect(r.observations.length).toBeGreaterThan(1);
    expect(unique(r.observations.map((x) => x.dedupeKey))).toBe(true);
  });

  it("survives bad lines", async () => {
    const f = fakeFetch([["cves.json", '{"ID":"CVE-2026-1001","Info":{"Name":"x"},"file_path":"a.yaml"}\nnot json\n']]);
    const r = await nucleiAdapter.run(ctx(f.fetch, { trackedCves: [] }));
    expect(r.observations).toHaveLength(1);
  });
});

describe("poc-github", () => {
  it("emits one claimed PoC observation per tracked CVE with a file", async () => {
    const f = fakeFetch([["2021/CVE-2021-44228.json", fixture("poc-github-CVE-2021-44228.json")]]);
    const r = await pocGithubAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228", "CVE-2026-1"] }));
    expect(r.observations).toHaveLength(1);
    expect(r.observations[0]).toMatchObject({ kind: "exploit_available", strength: "claimed", dedupeKey: "poc-github:CVE-2021-44228", metadata: { maturity: "poc", repoCount: 5 } });
    expect(r.vulnerabilities[0].exploitMaturity).toBe("poc");
  });
});

describe("exploitdb", () => {
  it("emits poc observations for tracked CVEs and recent entries", async () => {
    const f = fakeFetch([["files_exploits.csv", fixture("exploitdb.csv")]]);
    const r = await exploitdbAdapter.run(ctx(f.fetch, { trackedCves: ["CVE-2021-44228"] }));
    expect(r.observations.length).toBeGreaterThan(0);
    const o = r.observations[0];
    expect(o).toMatchObject({ kind: "exploit_available", strength: "reported" });
    expect(o.url).toMatch(/^https:\/\/www\.exploit-db\.com\/exploits\/\d+$/);
    expect(o.cveIds[0]).toMatch(/^CVE-/);
    expect(unique(r.observations.map((x) => x.dedupeKey))).toBe(true);
  });
});

describe("sec-8k", () => {
  it("maps Item 1.05 filings to confirmed damage with a filing URL", async () => {
    const f = fakeFetch([["efts.sec.gov", fixture("sec-8k.json")]]);
    const r = await sec8kAdapter.run(ctx(f.fetch));
    expect(r.observations).toHaveLength(4);
    const o = r.observations[0];
    expect(o).toMatchObject({ kind: "damage", strength: "confirmed", dedupeKey: "sec-8k:0001104659-26-109813", orgName: "Astrana Health, Inc." });
    expect(o.url).toBe("https://www.sec.gov/Archives/edgar/data/1083446/000110465926109813/asth-20260922x8k.htm");
    expect(o.cveIds).toEqual([]);
    expect(r.cursor).toBe("2026-10-24");
    expect(f.calls[0].url).toContain("startdt=2026-09-23");
  });

  it("uses the cursor for the window", async () => {
    const f = fakeFetch([["efts.sec.gov", '{"hits":{"hits":[]}}']]);
    await sec8kAdapter.run(ctx(f.fetch, { cursor: "2026-10-20" }));
    expect(f.calls[0].url).toContain("startdt=2026-10-19");
  });

  it("ignores filings without Item 1.05", async () => {
    const body = JSON.stringify({ hits: { hits: [{ _id: "a:b.htm", _source: { adsh: "a", items: ["8.01"], display_names: ["X"], ciks: ["1"] } }] } });
    const r = await sec8kAdapter.run(ctx(fakeFetch([["efts", body]]).fetch));
    expect(r.observations).toHaveLength(0);
  });
});

describe("hibp", () => {
  it("emits confirmed damage for new breaches after the cursor", async () => {
    const f = fakeFetch([["haveibeenpwned.com/api/v3/breaches", fixture("hibp.json")]]);
    const first = await hibpAdapter.run(ctx(f.fetch, { cursor: "2020-01-01T00:00:00Z" }));
    expect(first.observations.length).toBeGreaterThan(5);
    const o = first.observations[0];
    expect(o).toMatchObject({ kind: "damage", strength: "confirmed", cveIds: [] });
    expect(o.dedupeKey).toMatch(/^hibp:/);
    expect(o.summary).not.toMatch(/<a /);
    expect(o.url).toContain("haveibeenpwned.com");
    const second = await hibpAdapter.run(ctx(f.fetch, { cursor: first.cursor }));
    expect(second.observations).toHaveLength(0);
  });

  it("limits the first run to recent breaches", async () => {
    const f = fakeFetch([["breaches", fixture("hibp.json")]]);
    const r = await hibpAdapter.run(ctx(f.fetch));
    for (const o of r.observations) expect(o.publishedAt! >= "2026-07-26").toBe(true);
  });
});

describe("wa-ag", () => {
  it("maps notices to confirmed damage with counts", async () => {
    const f = fakeFetch([["data.wa.gov", fixture("wa-ag.json")]]);
    const r = await waAgAdapter.run(ctx(f.fetch));
    expect(r.observations).toHaveLength(15);
    expect(r.observations[0]).toMatchObject({ kind: "damage", strength: "confirmed", dedupeKey: "wa-ag:25772", orgName: "iRhythm Technologies Inc." });
    expect(r.observations[0].summary).toContain("Washingtonians affected: 220,745");
    expect(r.cursor).toBe("2026-10-06T00:00:00.000Z");
    expect(unique(r.observations.map((o) => o.dedupeKey))).toBe(true);
  });
});

describe("ca-ag", () => {
  it("parses the CSV export", async () => {
    const f = fakeFetch([["oag.ca.gov", fixture("ca-ag.csv")]]);
    const r = await caAgAdapter.run(ctx(f.fetch));
    expect(r.observations.length).toBeGreaterThan(10);
    expect(r.observations[0]).toMatchObject({ kind: "damage", strength: "confirmed", orgName: "BASS Medical Group", publishedAt: "2026-10-22T00:00:00.000Z" });
    expect(r.observations[0].dedupeKey).toBe("ca-ag:bass-medical-group:2026-10-22");
  });

  it("rejects an unexpected payload", async () => {
    await expect(caAgAdapter.run(ctx(fakeFetch([["oag", "<html>blocked</html>"]]).fetch))).rejects.toThrow();
  });
});
