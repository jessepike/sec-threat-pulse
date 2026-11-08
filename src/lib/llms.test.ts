import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_RULES_VERSION } from "@/lib/ladder/rules";
import { LLMS_TXT, llmsFull } from "./llms";

describe("llms-full.txt", () => {
  const doc = readFileSync(path.join(process.cwd(), "docs", "methodology-rules.md"), "utf8");
  const full = llmsFull(doc);

  it("starts with the llms.txt index and links back to itself from it", () => {
    expect(full.startsWith(LLMS_TXT)).toBe(true);
    expect(LLMS_TXT).toContain("/llms-full.txt");
  });

  it("carries the ladder, every rules version and the whole methodology doc", () => {
    expect(full).toContain("## The evidence ladder");
    for (const v of ["v0", "v1", "v2", "v3"]) expect(full).toContain(`- ${v} (`);
    expect(full).toContain(`${CURRENT_RULES_VERSION} (`);
    expect(full).toContain(", active)");
    expect(full).toContain(doc.trim());
  });

  it("keeps the plain language rules: no em dashes", () => {
    expect(full).not.toContain("—");
  });
});
