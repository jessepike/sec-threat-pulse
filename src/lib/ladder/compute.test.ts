import { describe, expect, it } from "vitest";
import { computeExploitMaturity, computeLadder, ladderEquals, type LadderObservation } from "./compute";
import { EMPTY_LADDER } from "./types";

const o = (kind: LadderObservation["kind"], strength: LadderObservation["strength"], sourceId = "s1", metadata?: Record<string, unknown>): LadderObservation => ({ kind, strength, sourceId, metadata });

describe("computeLadder", () => {
  it("is empty with no observations", () => {
    expect(computeLadder([])).toEqual(EMPTY_LADDER);
  });

  it("talk: one source is reported, two independent sources confirm", () => {
    expect(computeLadder([o("talk", "reported", "a")]).talk).toBe("reported");
    expect(computeLadder([o("talk", "reported", "a"), o("talk", "reported", "a")]).talk).toBe("reported");
    expect(computeLadder([o("talk", "reported", "a"), o("advisory", "confirmed", "b")]).talk).toBe("confirmed");
  });

  it("exposure: confirmed figure beats quoted figure", () => {
    expect(computeLadder([o("exposure", "quoted")]).exposure).toBe("reported");
    expect(computeLadder([o("exposure", "quoted"), o("exposure", "confirmed", "gov")]).exposure).toBe("confirmed");
  });

  it("attempts: telemetry or two independent reports confirm, one report is reported", () => {
    expect(computeLadder([o("attempts", "reported", "a")]).attempts).toBe("reported");
    expect(computeLadder([o("attempts", "reported", "a"), o("attempts", "reported", "a")]).attempts).toBe("reported");
    expect(computeLadder([o("attempts", "reported", "a"), o("attempts", "reported", "b")]).attempts).toBe("confirmed");
    expect(computeLadder([o("attempts", "confirmed", "telemetry")]).attempts).toBe("confirmed");
  });

  it("exploited: KEV confirms, a CIRCL sighting is reported", () => {
    expect(computeLadder([o("exploited", "confirmed", "cisa-kev")]).exploited).toBe("confirmed");
    expect(computeLadder([o("exploited", "reported", "circl-sightings")]).exploited).toBe("reported");
    expect(computeLadder([o("exploited", "reported"), o("exploited", "confirmed")]).exploited).toBe("confirmed");
  });

  it("damage: filings confirm, claims never count", () => {
    expect(computeLadder([o("damage", "confirmed", "sec-8k")]).damage).toBe("confirmed");
    expect(computeLadder([o("claim", "claimed", "leak-site")]).damage).toBe("none");
    expect(computeLadder([o("damage", "claimed", "leak-site")]).damage).toBe("none");
    expect(computeLadder([o("damage", "reported", "news")]).damage).toBe("reported");
  });

  it("claimed strength never moves any rung", () => {
    const l = computeLadder([o("exploited", "claimed"), o("attempts", "claimed"), o("talk", "claimed"), o("exposure", "claimed")]);
    expect(l).toEqual(EMPTY_LADDER);
  });

  it("does not let non-rung kinds move the ladder", () => {
    expect(computeLadder([o("exploit_available", "confirmed"), o("forecast", "reported")])).toEqual(EMPTY_LADDER);
  });

  it("does not infer lower rungs from higher ones", () => {
    const l = computeLadder([o("exploited", "confirmed")]);
    expect(l.attempts).toBe("none");
    expect(l.talk).toBe("none");
  });
});

describe("computeExploitMaturity", () => {
  it("is none without exploit observations", () => {
    expect(computeExploitMaturity([o("exploited", "confirmed")])).toBe("none");
  });
  it("reads metadata first, then falls back to source", () => {
    expect(computeExploitMaturity([o("exploit_available", "claimed", "poc-github", { maturity: "poc" })])).toBe("poc");
    expect(computeExploitMaturity([o("exploit_available", "confirmed", "metasploit")])).toBe("weaponized");
    expect(computeExploitMaturity([o("exploit_available", "confirmed", "nuclei")])).toBe("weaponized");
    expect(computeExploitMaturity([o("exploit_available", "reported", "exploitdb")])).toBe("poc");
    expect(computeExploitMaturity([o("exploit_available", "reported", "unknown-src")])).toBe("poc");
  });
  it("takes the highest across observations and vulnerability rows", () => {
    expect(computeExploitMaturity([o("exploit_available", "reported", "exploitdb")], ["weaponized"])).toBe("weaponized");
    expect(computeExploitMaturity([], ["poc", null, "bogus"])).toBe("poc");
  });
});

describe("ladderEquals", () => {
  it("compares rung by rung", () => {
    expect(ladderEquals({ ...EMPTY_LADDER }, { ...EMPTY_LADDER })).toBe(true);
    expect(ladderEquals({ ...EMPTY_LADDER }, { ...EMPTY_LADDER, talk: "reported" })).toBe(false);
  });
});
