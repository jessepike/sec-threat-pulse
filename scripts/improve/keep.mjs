#!/usr/bin/env node
// Keep or discard: compares two scorecards with the rule in metrics.mjs.
// Usage: node scripts/improve/keep.mjs <before.json> <after.json> --target <metric id | none>
// Exits 0 to keep, 1 to discard, 2 on bad input. Prints the reasons, ready for the ledger.
import { readFileSync } from "node:fs";
import { judge, METRICS } from "./metrics.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--target");
const target = i >= 0 ? args[i + 1] : undefined;
const [beforePath, afterPath] = args.filter((a, k) => !a.startsWith("--") && k !== i + 1);
if (!beforePath || !afterPath || !target) {
  console.error(`usage: keep.mjs <before.json> <after.json> --target <id|none>\nmetrics: ${Object.keys(METRICS).join(", ")}`);
  process.exit(2);
}
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const v = judge(read(beforePath), read(afterPath), target);
console.log(v.keep ? "KEEP" : "DISCARD");
for (const r of v.reasons) console.log(`- ${r}`);
process.exit(v.keep ? 0 : 1);
