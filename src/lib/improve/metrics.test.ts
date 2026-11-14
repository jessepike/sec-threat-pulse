import { describe, expect, it } from "vitest";
import { gain, judge, METRICS } from "../../../scripts/improve/metrics.mjs";

const card = (metrics: Record<string, number | null>) => ({ metrics });

describe("improve keep rule", () => {
  it("gain is positive when a metric moves the better way", () => {
    expect(gain("repo.sources", 30, 31)).toBe(1);
    expect(gain("repo.untrackedRungs", 2, 1)).toBe(1);
    expect(gain("bt.transitionsPerCve", 1.2, 1.3)).toBeCloseTo(-0.1);
    expect(gain("repo.sources", null, 31)).toBeNull();
  });

  it("keeps a change that moves the target past its noise band", () => {
    const v = judge(card({ "repo.sources": 30, "bt.earlyActNowRight30": 0.46 }), card({ "repo.sources": 31, "bt.earlyActNowRight30": 0.46 }), "repo.sources");
    expect(v.keep).toBe(true);
    expect(v.target?.gain).toBe(1);
  });

  it("discards a target move inside the noise band", () => {
    const v = judge(card({ "bt.earlyActNowRight30": 0.46 }), card({ "bt.earlyActNowRight30": 0.47 }), "bt.earlyActNowRight30");
    expect(v.keep).toBe(false);
  });

  it("discards when another metric regresses past its noise", () => {
    const v = judge(card({ "repo.sources": 30, "bt.kevCalledBeforeShare": 0.19 }), card({ "repo.sources": 31, "bt.kevCalledBeforeShare": 0.15 }), "repo.sources");
    expect(v.keep).toBe(false);
    expect(v.regressions.map((r) => r.id)).toEqual(["bt.kevCalledBeforeShare"]);
  });

  it("ignores small moves in other metrics", () => {
    const v = judge(card({ "repo.sources": 30, "bt.earlyActNowRight30": 0.46 }), card({ "repo.sources": 31, "bt.earlyActNowRight30": 0.45 }), "repo.sources");
    expect(v.keep).toBe(true);
  });

  it("discards when the target is missing on either side or unknown", () => {
    expect(judge(card({}), card({ "repo.sources": 31 }), "repo.sources").keep).toBe(false);
    expect(judge(card({ "repo.sources": 30 }), card({ "repo.sources": 31 }), "made.up").keep).toBe(false);
  });

  it("keeps a no-target change only when nothing regresses", () => {
    expect(judge(card({ "repo.sources": 30 }), card({ "repo.sources": 30 }), "none").keep).toBe(true);
    expect(judge(card({ "repo.sources": 30 }), card({ "repo.sources": 29 }), "none").keep).toBe(false);
  });

  it("defines a direction and a noise band for every metric", () => {
    for (const [id, d] of Object.entries(METRICS)) {
      expect(["up", "down"], id).toContain(d.better);
      expect(d.noise, id).toBeGreaterThanOrEqual(0);
    }
  });
});
