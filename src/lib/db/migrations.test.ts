import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Migrations run in the Vercel build while the previous deployment is still serving, so each one
 * must leave the old code working: add tables and columns, never drop, rename or tighten in the same
 * release. Two outages on Nov 8, 2026 came from schema and code landing out of step.
 *
 * A change that is really needed goes in two releases (stop using it, then remove it). Mark the
 * second one with a line `-- stp:allow-destructive <reason>` in the migration file.
 */
const DESTRUCTIVE: [RegExp, string][] = [
  [/\bDROP\s+(TABLE|COLUMN|SCHEMA|TYPE)\b/i, "drops a table, column, schema or type"],
  [/\bRENAME\s+(TO|COLUMN|CONSTRAINT)\b/i, "renames a table, column or constraint"],
  [/\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i, "changes a column type"],
  [/\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i, "makes an existing column required"],
  [/\bTRUNCATE\b/i, "truncates a table"],
];

export function destructiveStatements(sql: string): string[] {
  if (/^--\s*stp:allow-destructive\s+\S+/m.test(sql)) return [];
  const code = sql.replace(/--.*$/gm, "");
  return DESTRUCTIVE.filter(([re]) => re.test(code)).map(([, why]) => why);
}

describe("migrations stay additive", () => {
  const dir = path.join(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  it("finds the migration files", () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it.each(files)("%s does not drop, rename or tighten", (file) => {
    expect(destructiveStatements(readFileSync(path.join(dir, file), "utf8"))).toEqual([]);
  });
  it("catches the statements it guards against, and honors the marker", () => {
    expect(destructiveStatements('ALTER TABLE "events" DROP COLUMN "tier";')).toEqual(["drops a table, column, schema or type"]);
    expect(destructiveStatements('ALTER TABLE "events" RENAME COLUMN "tier" TO "level";')).toHaveLength(1);
    expect(destructiveStatements('ALTER TABLE "events" ALTER COLUMN "tier" SET NOT NULL;')).toHaveLength(1);
    expect(destructiveStatements('ALTER TABLE "events" ADD COLUMN "tier" text;')).toEqual([]);
    expect(destructiveStatements('-- stp:allow-destructive unused since v4\nALTER TABLE "events" DROP COLUMN "tier";')).toEqual([]);
  });
});
