import { describe, expect, it } from "vitest";
import { CURRENT_RULES_VERSION, RULES, evaluateVerdict, getRules } from "./index";
import { evaluateV0 } from "./v0";
import { evaluateV1 } from "./v1";
import { EMPTY_LADDER, type Ladder } from "../types";

const L = (p: Partial<Ladder>): Ladder => ({ ...EMPTY_LADDER, ...p });
const none = { exploitMaturity: "none" as const };

describe("rules v1: confirmed exploitation", () => {
  it("is Act now for a vulnerability under a year old", () => {
    const r = evaluateV1(L({ exploited: "confirmed" }), { ...none, daysSincePublished: 120 });
    expect(r.verdict).toBe("act_now");
    expect(r.reason).toContain("120 days old");
  });

  it("is Act now for old vulnerabilities only with an amplifier", () => {
    const old = { ...none, daysSincePublished: 2000, cvss: 7.8 };
    expect(evaluateV1(L({ exploited: "confirmed" }), old).verdict).toBe("watch");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...old, kevRansomware: true }).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...old, exploitMaturity: "weaponized" }).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...old, vendor: "Cisco", product: "ASA" }).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...old, cvss: 9.8 }).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...old, epss: 0.5 }).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...old, epss: 0.49 }).verdict).toBe("watch");
  });

  it("never drops below Watch and never lowers the verdict when confirmation follows a report", () => {
    // A new CVE with a reported attack is Act now; confirmation keeps it there.
    const ctx = { ...none, daysSincePublished: 3 };
    expect(evaluateV1(L({ exploited: "reported" }), ctx).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), ctx).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "confirmed" }), { ...none, daysSincePublished: undefined }).verdict).toBe("watch");
  });
});

describe("rules v1: reported exploitation", () => {
  it("is Act now within 90 days of publication, Watch after", () => {
    expect(evaluateV1(L({ exploited: "reported" }), { ...none, daysSincePublished: 0 }).reason).toContain("new today");
    expect(evaluateV1(L({ exploited: "reported" }), { ...none, daysSincePublished: 90 }).verdict).toBe("act_now");
    expect(evaluateV1(L({ exploited: "reported" }), { ...none, daysSincePublished: 91 }).verdict).toBe("watch");
    expect(evaluateV1(L({ exploited: "reported" }), { exploitMaturity: "weaponized" }).verdict).toBe("watch");
  });
});

describe("rules v1: watch and low", () => {
  it("watches attempts, damage, tools, a crowd of proof of concept code and high EPSS", () => {
    expect(evaluateV1(L({ attempts: "confirmed" }), none).verdict).toBe("watch");
    expect(evaluateV1(L({ attempts: "reported" }), none).verdict).toBe("watch");
    expect(evaluateV1(L({ damage: "reported" }), none).verdict).toBe("watch");
    expect(evaluateV1(L({}), { exploitMaturity: "weaponized" }).verdict).toBe("watch");
    expect(evaluateV1(L({}), { exploitMaturity: "poc", pocRepoCount: 3 }).verdict).toBe("watch");
    expect(evaluateV1(L({}), { exploitMaturity: "poc", pocRepoCount: 2 }).verdict).toBe("low");
    expect(evaluateV1(L({}), { ...none, epss: 0.3 }).verdict).toBe("watch");
    expect(evaluateV1(L({}), { ...none, epss: 0.29 }).verdict).toBe("low");
  });

  it("is Low with only talk, exposure or a single proof of concept", () => {
    expect(evaluateV1(L({ talk: "confirmed", exposure: "reported" }), { exploitMaturity: "poc", pocRepoCount: 1, cvss: 9.8 }).verdict).toBe("low");
    expect(evaluateV1(EMPTY_LADDER, none).verdict).toBe("low");
  });

  it("is monotonic in the ladder: a higher rung never lowers the verdict", () => {
    const ctxs = [none, { ...none, daysSincePublished: 10 }, { ...none, daysSincePublished: 500 }, { exploitMaturity: "weaponized" as const, epss: 0.6, cvss: 9.9 }];
    const rank = { low: 0, watch: 1, act_now: 2 };
    for (const ctx of ctxs) {
      const low = rank[evaluateV1(EMPTY_LADDER, ctx).verdict];
      const attempts = rank[evaluateV1(L({ attempts: "reported" }), ctx).verdict];
      const reported = rank[evaluateV1(L({ exploited: "reported", attempts: "reported" }), ctx).verdict];
      const confirmed = rank[evaluateV1(L({ exploited: "confirmed", attempts: "confirmed" }), ctx).verdict];
      expect(attempts).toBeGreaterThanOrEqual(low);
      expect(reported).toBeGreaterThanOrEqual(attempts);
      expect(confirmed).toBeGreaterThanOrEqual(reported);
    }
  });
});

describe("rules v1: wording", () => {
  it("uses plain sentences with no dashes", () => {
    const cases = [
      evaluateV1(L({ exploited: "confirmed" }), { exploitMaturity: "weaponized", kevRansomware: true, epss: 0.9, cvss: 9.8, daysSincePublished: 4, vendor: "Cisco", product: "ASA" }),
      evaluateV1(L({ exploited: "confirmed" }), { ...none, daysSincePublished: 900 }),
      evaluateV1(L({ exploited: "reported" }), { ...none, daysSincePublished: 12 }),
      evaluateV1(L({ exploited: "reported" }), { ...none, daysSincePublished: 400 }),
      evaluateV1(L({ attempts: "confirmed" }), none),
      evaluateV1(L({}), { exploitMaturity: "poc", pocRepoCount: 5 }),
      evaluateV1(L({}), { ...none, epss: 0.4 }),
      evaluateV1(EMPTY_LADDER, none),
    ];
    for (const c of cases) {
      expect(c.reason).not.toMatch(/[–—]/);
      expect(c.reason).not.toMatch(/, not /);
      expect(c.reason.length).toBeGreaterThan(10);
      expect(c.reason.endsWith(".")).toBe(true);
    }
    expect(cases[0].reason).toBe(
      "Attacks are confirmed. Ransomware groups are known to use it. The vulnerability is 4 days old, so current versions are being attacked. Ready-made attack tools are public. It affects a product that faces the internet or gives remote access. The severity score is critical (9.8). The exploit prediction score is 90%.",
    );
  });
});

describe("rules registry", () => {
  it("keeps v0 and v1 frozen and makes v2 current", () => {
    expect(getRules("v1")).toBe(RULES.v1);
    expect(CURRENT_RULES_VERSION).toBe("v2");
    expect(evaluateVerdict(EMPTY_LADDER, none).rulesVersion).toBe("v2");
    // v1 still answers the same as before for the same inputs (the backtest replays it).
    expect(evaluateV1(L({ exploited: "reported" }), { ...none, daysSincePublished: 10 }).verdict).toBe("act_now");
    // v0 still answers the same as before for the same inputs (the backtest replays it).
    expect(evaluateV0(L({ exploited: "reported" }), { exploitMaturity: "weaponized" }).verdict).toBe("act_now");
    expect(evaluateV0(L({ exploited: "confirmed" }), { ...none, daysSincePublished: 10 }).verdict).toBe("watch");
  });
});
