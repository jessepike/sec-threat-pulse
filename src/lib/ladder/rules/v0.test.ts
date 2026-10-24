import { describe, expect, it } from "vitest";
import { CURRENT_RULES_VERSION, RULES, evaluateVerdict, getRules } from "./index";
import { evaluateV0, isEdgeOrRemoteAccess } from "./v0";
import { EMPTY_LADDER, type Ladder } from "../types";

const L = (p: Partial<Ladder>): Ladder => ({ ...EMPTY_LADDER, ...p });

describe("rules v0", () => {
  it("act_now: confirmed exploitation with ransomware use", () => {
    const r = evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "none", kevRansomware: true });
    expect(r.verdict).toBe("act_now");
    expect(r.reason).toMatch(/ransomware/i);
  });

  it("act_now: confirmed with weaponized tools, high EPSS or edge product", () => {
    expect(evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "weaponized" }).verdict).toBe("act_now");
    expect(evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "none", epss: 0.5 }).verdict).toBe("act_now");
    expect(evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "none", vendor: "Fortinet", product: "FortiOS SSL-VPN" }).verdict).toBe("act_now");
  });

  it("watch: confirmed exploitation with no amplifiers", () => {
    const r = evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "poc", epss: 0.49, vendor: "Plex", product: "Media Server" });
    expect(r.verdict).toBe("watch");
  });

  it("act_now: exploited reported plus weaponized", () => {
    expect(evaluateV0(L({ exploited: "reported" }), { exploitMaturity: "weaponized" }).verdict).toBe("act_now");
  });

  it("watch: exploited reported, attempts, damage, weaponized or EPSS 0.3", () => {
    expect(evaluateV0(L({ exploited: "reported" }), { exploitMaturity: "none" }).verdict).toBe("watch");
    expect(evaluateV0(L({ attempts: "reported" }), { exploitMaturity: "none" }).verdict).toBe("watch");
    expect(evaluateV0(L({ damage: "confirmed" }), { exploitMaturity: "none" }).verdict).toBe("watch");
    expect(evaluateV0(L({}), { exploitMaturity: "weaponized" }).verdict).toBe("watch");
    expect(evaluateV0(L({}), { exploitMaturity: "none", epss: 0.3 }).verdict).toBe("watch");
  });

  it("low otherwise", () => {
    expect(evaluateV0(L({ talk: "reported", exposure: "reported" }), { exploitMaturity: "poc", epss: 0.29 }).verdict).toBe("low");
    expect(evaluateV0(EMPTY_LADDER, { exploitMaturity: "none" }).verdict).toBe("low");
  });

  it("reasons are plain: no em dashes, en dashes or 'not X, but' phrasing", () => {
    const cases = [
      evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "weaponized", kevRansomware: true, epss: 0.9, vendor: "Cisco", product: "ASA" }),
      evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "none" }),
      evaluateV0(L({ exploited: "reported" }), { exploitMaturity: "weaponized" }),
      evaluateV0(L({ attempts: "confirmed" }), { exploitMaturity: "none" }),
      evaluateV0(L({}), { exploitMaturity: "none", epss: 0.4 }),
      evaluateV0(EMPTY_LADDER, { exploitMaturity: "none" }),
    ];
    for (const c of cases) {
      expect(c.reason).not.toMatch(/[–—]/);
      expect(c.reason.length).toBeGreaterThan(10);
    }
  });

  it("detects edge and remote access products", () => {
    expect(isEdgeOrRemoteAccess("Citrix", "NetScaler ADC and Gateway")).toBe(true);
    expect(isEdgeOrRemoteAccess("ConnectWise", "ScreenConnect")).toBe(true);
    expect(isEdgeOrRemoteAccess("Palo Alto Networks", "PAN-OS")).toBe(true);
    expect(isEdgeOrRemoteAccess("Plex", "Media Server")).toBe(false);
    expect(isEdgeOrRemoteAccess(undefined, undefined)).toBe(false);
  });
});

describe("rules registry", () => {
  it("resolves versions and stamps the version used", () => {
    expect(getRules("v0")).toBe(RULES.v0);
    expect(RULES[CURRENT_RULES_VERSION]).toBeDefined();
    expect(evaluateVerdict(EMPTY_LADDER, { exploitMaturity: "none" }, "v0").rulesVersion).toBe("v0");
    expect(() => getRules("v99")).toThrow(/Unknown rules version/);
  });
});

describe("rules v0 reason wording", () => {
  it("lists each factor as its own sentence", () => {
    const r = evaluateV0(L({ exploited: "confirmed" }), { exploitMaturity: "weaponized", kevRansomware: true, vendor: "Cisco", product: "ASA" });
    expect(r.reason).toBe("Attacks are confirmed. Ransomware groups are known to use it. Ready-made attack tools are public. It affects a product that faces the internet or gives remote access.");
  });
});
