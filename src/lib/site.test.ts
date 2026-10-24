import { describe, expect, it } from "vitest";
import { indexingAllowed } from "./site";

describe("indexingAllowed", () => {
  it("is on only for the exact string true", () => {
    expect(indexingAllowed({ STP_ALLOW_INDEXING: "true" })).toBe(true);
    for (const v of [undefined, "", "false", "1", "TRUE", "yes"]) expect(indexingAllowed({ STP_ALLOW_INDEXING: v })).toBe(false);
  });
});
