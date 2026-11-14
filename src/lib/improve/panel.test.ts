import { describe, expect, it } from "vitest";
import { panelApproves } from "../../../scripts/improve/panel.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const c = (body: string, author_association = "OWNER") => ({ body, author_association });

describe("review panel approval", () => {
  it("accepts an owner comment for this commit at this tier or higher", () => {
    expect(panelApproves([c(`Panel: C a, S a <!-- improve-panel: sha=${SHA} tier=1 -->`)], SHA, 1)).toBe(true);
    expect(panelApproves([c(`<!-- improve-panel: sha=${SHA} tier=2 -->`)], SHA, 1)).toBe(true);
    expect(panelApproves([c(`<!-- improve-panel: sha=${SHA} tier=rules -->`)], SHA, "rules")).toBe(true);
  });

  it("rejects an approval of an older commit", () => {
    expect(panelApproves([c(`<!-- improve-panel: sha=${OTHER} tier=2 -->`)], SHA, 1)).toBe(false);
  });

  it("rejects an approval for a lower tier than the change now needs", () => {
    expect(panelApproves([c(`<!-- improve-panel: sha=${SHA} tier=1 -->`)], SHA, 2)).toBe(false);
    expect(panelApproves([c(`<!-- improve-panel: sha=${SHA} tier=2 -->`)], SHA, "rules")).toBe(false);
  });

  it("ignores comments from anyone but the owner's account", () => {
    expect(panelApproves([c(`<!-- improve-panel: sha=${SHA} tier=2 -->`, "NONE")], SHA, 1)).toBe(false);
    expect(panelApproves([c(`<!-- improve-panel: sha=${SHA} tier=2 -->`, "CONTRIBUTOR")], SHA, 1)).toBe(false);
  });

  it("ignores comments without the marker", () => {
    expect(panelApproves([c("looks good"), c("")], SHA, 1)).toBe(false);
  });
});
