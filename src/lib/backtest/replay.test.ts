import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeLadder } from "@/lib/ladder/compute";
import { circlSightingsAdapter, classifyCirclSource } from "@/lib/ingest/adapters/circl-sightings";
import { circlObservation, confirmation, epssAsOf, firstDayAtLeast, replayCve, stateAsOf, verdictOn } from "./replay";
import type { BacktestCve, CirclSighting } from "./types";

const base = (p: Partial<BacktestCve> = {}): BacktestCve => ({
  cveId: "CVE-2026-1000",
  stratum: "signal",
  published: "2026-01-10",
  cvss: 9.8,
  vendor: "Acme",
  product: "Gateway",
  epss: [],
  metasploit: [],
  pocGithub: [],
  exploitdb: [],
  circl: [],
  ...p,
});

describe("epssAsOf", () => {
  it("holds the last change point at or before the day", () => {
    const pts: [string, number][] = [["2026-01-01", 0.01], ["2026-01-10", 0.5], ["2026-02-01", 0.9]];
    expect(epssAsOf(pts, "2025-12-31")).toBeUndefined();
    expect(epssAsOf(pts, "2026-01-01")).toBe(0.01);
    expect(epssAsOf(pts, "2026-01-15")).toBe(0.5);
    expect(epssAsOf(pts, "2026-03-01")).toBe(0.9);
  });
});

describe("stateAsOf", () => {
  it("only includes signals public on or before the day", () => {
    const cve = base({
      kev: { dateAdded: "2026-02-01", ransomware: true },
      metasploit: ["2026-01-20"],
      pocGithub: [{ created: "2026-01-12", stars: 3 }, { created: "2026-01-25", stars: 10 }],
      epss: [["2026-01-10", 0.1], ["2026-01-21", 0.6]],
    });
    const early = stateAsOf(cve, "2026-01-15");
    expect(early.observations.map((o) => o.sourceId)).toEqual(["poc-github"]);
    expect(early.ctx).toMatchObject({ exploitMaturity: "poc", epss: 0.1, kevRansomware: false, pocRepoCount: 1, daysSincePublished: 5, cvss: 9.8 });

    const mid = stateAsOf(cve, "2026-01-21");
    expect(mid.observations.map((o) => o.sourceId).sort()).toEqual(["metasploit", "poc-github"]);
    expect(mid.ctx.exploitMaturity).toBe("weaponized");
    expect(mid.ctx.epss).toBe(0.6);

    const late = stateAsOf(cve, "2026-02-01");
    expect(late.observations.some((o) => o.sourceId === "cisa-kev" && o.kind === "exploited" && o.strength === "confirmed")).toBe(true);
    expect(late.ctx.kevRansomware).toBe(true);
    expect(late.ctx.pocRepoCount).toBe(2);
  });

  it("maps SSVC active to confirmed exploitation and SSVC poc to maturity", () => {
    const poc = stateAsOf(base({ ssvc: { poc: "2026-01-11" } }), "2026-01-12");
    expect(poc.ctx.exploitMaturity).toBe("poc");
    const active = stateAsOf(base({ ssvc: { active: "2026-01-11", poc: "2026-01-11" } }), "2026-01-12");
    expect(active.observations).toEqual([{ sourceId: "cvelist", kind: "exploited", strength: "confirmed", metadata: { ssvc: { exploitation: "active" } } }]);
  });
});

describe("circlObservation", () => {
  it("maps honeypots to confirmed attempts, reports to reported exploitation, catalogs to nothing", () => {
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "honeypot", sourceId: "shadowserver" }, false)).toMatchObject({ kind: "attempts", strength: "confirmed" });
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "telegram", sourceId: "telegram" }, false)).toMatchObject({ kind: "exploited", strength: "reported" });
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" }, false)).toBeUndefined();
    expect(circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" }, true)).toMatchObject({ kind: "exploited", strength: "reported" });
    expect(circlObservation({ type: "poc", date: "2026-01-01", sourceKind: "other", sourceId: "github.com" }, false)).toMatchObject({ kind: "exploit_available" });
  });
});

describe("confirmation", () => {
  const reports = base({
    circl: [
      { type: "exploited", date: "2026-01-15", sourceKind: "telegram", sourceId: "telegram" },
      { type: "exploited", date: "2026-01-16", sourceKind: "telegram", sourceId: "telegram" },
      { type: "exploited", date: "2026-01-20", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" },
      { type: "exploited", date: "2026-01-22", sourceKind: "honeypot", sourceId: "shadowserver" },
      { type: "exploited", date: "2026-01-25", sourceKind: "other", sourceId: "www.example.com" },
    ],
  });

  it("uses only KEV, VulnCheck KEV and vendor confirmation by default", () => {
    expect(confirmation(base())).toEqual({});
    expect(confirmation(base({ kev: { dateAdded: "2026-03-01", ransomware: false }, ssvc: { active: "2026-02-20" } }))).toEqual({ at: "2026-03-01", by: "cisa-kev" });
    expect(confirmation(base({ kev: { dateAdded: "2026-03-01", ransomware: false }, vulncheckKev: { dateAdded: "2026-02-20" } }))).toEqual({ at: "2026-02-20", by: "vulncheck-kev" });
    expect(confirmation(base({ vendorConfirmed: "2026-02-01", kev: { dateAdded: "2026-03-01", ransomware: false } }))).toEqual({ at: "2026-02-01", by: "vendor" });
    expect(confirmation(reports)).toEqual({});
  });

  it("in the secondary circl view, two distinct non catalog non honeypot sources confirm, on the day they are seen", () => {
    expect(confirmation(reports, { truth: "circl", circlLagDays: 0 })).toEqual({ at: "2026-01-25", by: "circl-reports" });
    expect(confirmation(reports, { truth: "circl" })).toEqual({ at: "2026-01-26", by: "circl-reports" });
    const telegramOnly = base({ circl: reports.circl.slice(0, 4) });
    expect(confirmation(telegramOnly, { truth: "circl" })).toEqual({});
  });
});

describe("CIRCL lag", () => {
  const s: CirclSighting = { type: "exploited", date: "2026-01-20", sourceKind: "telegram", sourceId: "telegram" };
  it("sees a sighting one day after its timestamp by default, same day with lag 0", () => {
    const cve = base({ circl: [s] });
    expect(stateAsOf(cve, "2026-01-20").observations).toEqual([]);
    expect(stateAsOf(cve, "2026-01-21").observations.map((o) => o.kind)).toEqual(["exploited"]);
    expect(stateAsOf(cve, "2026-01-20", { circlLagDays: 0 }).observations.map((o) => o.kind)).toEqual(["exploited"]);
  });
});

describe("production parity", () => {
  it("maps the recorded CIRCL fixtures the same way through the live adapter and the replay", async () => {
    const files: Record<string, string> = { exploited: "circl-exploited.json", "published-proof-of-concept": "circl-published-proof-of-concept.json", confirmed: "circl-confirmed.json", seen: "circl-seen.json" };
    const typeOf: Record<string, CirclSighting["type"]> = { exploited: "exploited", "published-proof-of-concept": "poc", confirmed: "confirmed" };
    const raw: { type: string; source?: string; vulnerability?: string; uuid: string }[] = [];
    const fetchFixture: typeof fetch = async (url) => {
      const type = String(url).match(/type=([a-z-]+)/)![1];
      return new Response(readFileSync(`src/lib/ingest/__fixtures__/${files[type]}`), { status: 200, headers: { "content-type": "application/json" } });
    };
    for (const f of Object.values(files)) raw.push(...(JSON.parse(readFileSync(`src/lib/ingest/__fixtures__/${f}`, "utf8")) as { data: typeof raw }).data);
    const live = await circlSightingsAdapter.run({ fetch: fetchFixture, now: new Date(), sleep: async () => {} });
    const liveByKey = new Map(live.observations.map((o) => [o.dedupeKey, o]));

    let compared = 0;
    let dropped = 0;
    for (const r of raw) {
      const type = typeOf[r.type];
      if (!type) continue; // "seen" sightings are not in the backtest dataset
      const k = classifyCirclSource(r.source);
      const replay = circlObservation({ type, date: "2026-01-01", sourceKind: k.kind, sourceId: k.id }, false);
      const prod = liveByKey.get(`circl:${r.uuid}`);
      if (!replay) {
        expect(prod, `${r.uuid} dropped by replay but kept live`).toBeUndefined();
        dropped++;
        continue;
      }
      expect(prod, `${r.uuid} kept by replay but dropped live`).toBeDefined();
      expect({ kind: prod!.kind, strength: prod!.strength }).toEqual({ kind: replay.kind, strength: replay.strength });
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
    expect(dropped).toBeGreaterThan(0); // the fixture has KEV catalog mirrors, and both sides drop them
    // Catalog mirrors never reach the exploited rung on either side.
    const catalog = raw.filter((r) => classifyCirclSource(r.source).kind === "kev-catalog");
    expect(catalog.length).toBeGreaterThan(0);
    for (const r of catalog) expect(liveByKey.has(`circl:${r.uuid}`)).toBe(false);
    const ladder = computeLadder(catalog.map(() => circlObservation({ type: "exploited", date: "2026-01-01", sourceKind: "kev-catalog", sourceId: "circl-kev-catalog" }, false)).filter((o) => !!o));
    expect(ladder.exploited).toBe("none");
  });
});

describe("replayCve", () => {
  it("starts at the publish day, records only verdict changes, and never reads the future", () => {
    const cve = base({ kev: { dateAdded: "2026-02-01", ransomware: true }, epss: [["2026-01-10", 0.01]] });
    const r = replayCve(cve, { rulesVersion: "v0", from: "2026-01-01", to: "2026-02-10" });
    expect(r.start).toBe("2026-01-10");
    expect(r.transitions.map((t) => [t.day, t.verdict])).toEqual([["2026-01-10", "low"], ["2026-02-01", "act_now"]]);
    expect(r.confirmedAt).toBe("2026-02-01");
    expect(r.confirmedBy).toBe("cisa-kev");
    expect(verdictOn(r, "2026-01-31")).toBe("low");
    expect(verdictOn(r, "2026-02-01")).toBe("act_now");
    expect(verdictOn(r, "2026-01-01")).toBeUndefined();
    expect(firstDayAtLeast(r, "watch")).toBe("2026-02-01");
  });

  it("starts at the window start for CVEs published earlier and handles empty windows", () => {
    const cve = base({ published: "2020-01-01" });
    expect(replayCve(cve, { rulesVersion: "v0", from: "2026-01-01", to: "2026-01-03" }).start).toBe("2026-01-01");
    expect(replayCve(cve, { rulesVersion: "v0", from: "2026-01-01", to: "2026-01-03" }).leftCensored).toBeUndefined();
    // Published before the window with a pre-window tool: above Low on day one, so left censored.
    const censored = replayCve(base({ published: "2025-12-01", metasploit: ["2025-12-15"] }), { rulesVersion: "v1", from: "2026-01-01", to: "2026-01-03" });
    expect(censored.leftCensored).toBe(true);
    expect(replayCve(base({ published: "2026-05-01" }), { rulesVersion: "v0", from: "2026-01-01", to: "2026-01-03" }).transitions).toEqual([]);
  });
});
