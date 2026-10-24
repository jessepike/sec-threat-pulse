// Dataset and report files. Kept apart from the pure replay and scoring code.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import type { BacktestDataset } from "./types";

export const DEFAULT_DATASET_PATHS = ["data/backtest/dataset.json.gz", ".cache/backtest/dataset.json.gz"];

export function findDataset(explicit?: string): string {
  const candidates = explicit ? [explicit] : DEFAULT_DATASET_PATHS;
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`No dataset found at ${candidates.join(" or ")}. Run: npx tsx scripts/backtest/build-dataset.ts`);
  return found;
}

export function loadDataset(path: string): BacktestDataset {
  const raw = readFileSync(path);
  const text = path.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text) as BacktestDataset;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
