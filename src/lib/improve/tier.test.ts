import { describe, expect, it } from "vitest";
import { classify, MAX_LINES_BELOW_TIER2 } from "../../../scripts/improve/tier.mjs";

const f = (path: string, status = "modified", additions = 5, deletions = 1) => ({ path, status, additions, deletions });

describe("improve tier", () => {
  it("keeps docs and notes at tier 0", () => {
    expect(classify([f("status.md"), f("docs/improve/ledger.md"), f("docs/research/x.md"), f("lessons.md")]).tier).toBe(0);
  });

  it("puts pages, components and library code at tier 1", () => {
    expect(classify([f("src/components/home.tsx")]).tier).toBe(1);
    expect(classify([f("src/app/(site)/events/page.tsx")]).tier).toBe(1);
  });

  it("treats an edited adapter as tier 1 and a new adapter as tier 2", () => {
    expect(classify([f("src/lib/ingest/adapters/msrc.ts")]).tier).toBe(1);
    expect(classify([f("src/lib/ingest/adapters/euvd.ts", "added")]).tier).toBe(2);
  });

  it("puts schema, workflows, the scorecard and methodology at tier 2", () => {
    for (const p of ["drizzle/0003_x.sql", ".github/workflows/ci.yml", "scripts/improve/metrics.mjs", "docs/improve/program.md", "docs/methodology-rules.md", "src/lib/ingest/registry.ts", "package.json", "src/lib/backtest/score.ts", "src/lib/ladder/coverage.ts"]) {
      expect(classify([f(p)]).tier, p).toBe(2);
    }
  });

  it("marks rules changes and owner files", () => {
    expect(classify([f("src/lib/ladder/rules/v4.ts", "added")]).tier).toBe("rules");
    expect(classify([f("intent.md")]).tier).toBe("owner");
    expect(classify([f("docs/improve/PAUSE", "removed")]).tier).toBe("owner");
    expect(classify([f("intent.md"), f("src/lib/ladder/rules/v4.ts")]).tier).toBe("owner");
  });

  it("takes the highest tier of all files", () => {
    expect(classify([f("status.md"), f("src/components/ui.tsx"), f(".github/workflows/ci.yml")]).tier).toBe(2);
  });

  it("raises a large change to tier 2 but does not count the lockfile or fixtures", () => {
    const big = classify([f("src/components/home.tsx", "modified", MAX_LINES_BELOW_TIER2, 1)]);
    expect(big.tier).toBe(2);
    expect(big.lines).toBe(MAX_LINES_BELOW_TIER2 + 1);
    const lock = classify([f("src/components/home.tsx"), f("src/lib/ingest/__fixtures__/x.json", "added", 5000, 0)]);
    expect(lock.tier).toBe(1);
  });
});
