import { describe, expect, it } from "vitest";
import { buildEvents, clusterKev, kevDate, slug, type EventObservation, type EventVuln } from "./events";
import { CURRENT_RULES_VERSION } from "./rules";

const now = new Date("2026-10-24T00:00:00Z");
const v = (cveId: string, kev: string, vendor = "Plex", product = "Media Server", extra: Partial<EventVuln> = {}): EventVuln => ({
  cveId,
  vendor,
  product,
  kevCisaDateAdded: kev,
  title: `${vendor} ${product} ${cveId}`,
  ...extra,
});
const obs = (id: number, cveIds: string[], kind: EventObservation["kind"], strength: EventObservation["strength"], sourceId = "cisa-kev"): EventObservation => ({ id, cveIds, kind, strength, sourceId });

describe("clusterKev", () => {
  it("groups the same vendor and product within 3 days, chaining", () => {
    const c = clusterKev([v("CVE-2026-1001", "2026-10-01"), v("CVE-2026-1002", "2026-10-04"), v("CVE-2026-1003", "2026-10-07"), v("CVE-2026-1004", "2026-10-12")]);
    expect(c.map((x) => x.vulns.map((y) => y.cveId))).toEqual([["CVE-2026-1001", "CVE-2026-1002", "CVE-2026-1003"], ["CVE-2026-1004"]]);
  });

  it("separates products and vendors, ignoring case and punctuation", () => {
    const c = clusterKev([v("CVE-2026-1", "2026-10-01", "Plex", "Media Server"), v("CVE-2026-2", "2026-10-01", "plex", "media-server"), v("CVE-2026-3", "2026-10-01", "Plex", "Other")]);
    expect(c).toHaveLength(2);
  });

  it("ignores CVEs without a KEV date and uses the earlier of CISA and VulnCheck", () => {
    expect(clusterKev([{ cveId: "CVE-2026-1", vendor: "A", product: "B" }])).toHaveLength(0);
    expect(kevDate({ cveId: "x", kevCisaDateAdded: "2026-10-05", kevVulncheckDateAdded: "2026-10-01T00:00:00Z" })).toBe("2026-10-01");
  });
});

describe("buildEvents", () => {
  it("creates stable slug ids from first date, vendor and product", () => {
    const e = buildEvents([v("CVE-2026-1001", "2026-10-20", "Palo Alto Networks", "PAN-OS")], [], { now });
    expect(e[0].id).toBe("kev-2026-10-20-palo-alto-networks-pan-os");
    const again = buildEvents([v("CVE-2026-1001", "2026-10-20", "Palo Alto Networks", "PAN-OS"), v("CVE-2026-1002", "2026-10-22", "Palo Alto Networks", "PAN-OS")], [], { now });
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(e[0].id);
    expect(again[0].cveIds).toEqual(["CVE-2026-1001", "CVE-2026-1002"]);
    expect(again[0].title).toBe("Palo Alto Networks PAN-OS: 2 vulnerabilities exploited");
  });

  it("disambiguates colliding slugs", () => {
    const e = buildEvents([v("CVE-2026-1", "2026-10-20", "ab", "X"), v("CVE-2026-2", "2026-10-20", "Äb", "X")], [], { now });
    expect(e.map((x) => x.id)).toEqual(["kev-2026-10-20-ab-x", "kev-2026-10-20-ab-x-2"]);
  });

  it("attaches observations by CVE and computes ladder, maturity and verdict", () => {
    const vulns = [v("CVE-2026-1001", "2026-10-20", "Fortinet", "FortiOS", { epss: 0.7, kevCisaRansomware: true })];
    const observations = [
      obs(1, ["CVE-2026-1001"], "exploited", "confirmed"),
      obs(2, ["CVE-2026-1001"], "exploit_available", "confirmed", "metasploit"),
      obs(3, ["CVE-2026-9999"], "exploited", "confirmed"),
      obs(4, [], "damage", "confirmed", "hibp"),
    ];
    const [e] = buildEvents(vulns, observations, { now });
    expect(e.observationIds).toEqual([1, 2]);
    expect(e.ladder.exploited).toBe("confirmed");
    expect(e.ladder.damage).toBe("none");
    expect(e.exploitMaturity).toBe("weaponized");
    expect(e.verdict).toBe("act_now");
    expect(e.rulesVersion).toBe(CURRENT_RULES_VERSION);
    expect(e.firstSeenAt).toBe("2026-10-20T00:00:00.000Z");
  });

  it("shares an observation across the CVEs of an event only once", () => {
    const [e] = buildEvents([v("CVE-2026-1", "2026-10-20"), v("CVE-2026-2", "2026-10-21")], [obs(1, ["CVE-2026-1", "CVE-2026-2"], "exploit_available", "reported", "exploitdb")], { now });
    expect(e.observationIds).toEqual([1]);
    expect(e.exploitMaturity).toBe("poc");
  });

  it("drops clusters older than the lookback", () => {
    const e = buildEvents([v("CVE-2026-1", "2026-06-01"), v("CVE-2026-2", "2026-10-20", "Other", "Thing")], [], { now, lookbackDays: 60 });
    expect(e.map((x) => x.cveIds[0])).toEqual(["CVE-2026-2"]);
  });

  it("uses a single CVE title when there is one CVE", () => {
    const [e] = buildEvents([v("CVE-2026-1", "2026-10-20", "Plex", "Media Server", { title: "Plex Media Server RCE" })], [], { now });
    expect(e.title).toBe("Plex Media Server RCE");
  });

  it("is deterministic regardless of input order", () => {
    const a = [v("CVE-2026-1", "2026-10-20"), v("CVE-2026-2", "2026-10-21"), v("CVE-2026-3", "2026-10-01", "Z", "Y")];
    expect(buildEvents(a, [], { now })).toEqual(buildEvents([...a].reverse(), [], { now }));
  });
});

describe("slug", () => {
  it("makes lowercase ascii slugs", () => {
    expect(slug("Palo Alto Networks, Inc.")).toBe("palo-alto-networks-inc");
    expect(slug("")).toBe("");
  });
});
