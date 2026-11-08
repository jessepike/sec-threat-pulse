import { describe, expect, it } from "vitest";
import { EMPTY_LADDER } from "./types";
import { untrackedNote, untrackedRungs } from "./coverage";

describe("untrackedRungs", () => {
  it("names exposure and damage on a vulnerability event with no evidence on them", () => {
    expect(untrackedRungs("vulnerability", { ...EMPTY_LADDER, exploited: "confirmed", attempts: "confirmed" })).toEqual(["exposure", "damage"]);
  });
  it("drops a rung once evidence arrives", () => {
    expect(untrackedRungs("vulnerability", { ...EMPTY_LADDER, damage: "reported" })).toEqual(["exposure"]);
  });
  it("treats a missing kind as a vulnerability and an unknown kind as fully tracked", () => {
    expect(untrackedNote(null, "exposure")).toMatch(/no source/);
    expect(untrackedNote("breach", "damage")).toBeNull();
    expect(untrackedNote("vulnerability", "talk")).toBeNull();
  });
});
