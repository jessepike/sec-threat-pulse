import { describe, expect, it } from "vitest";
import { isDelayed } from "./StatusStrip";
import type { StatusView } from "@/lib/data/types";

const base: StatusView = { mode: "live", lastRunAt: null, nextRunAt: null, progress: null, runsPerDay: "", sourceCount: 1 };
const now = Date.parse("2026-10-25T12:00:00Z");

describe("isDelayed", () => {
  it("is false within an hour of the last run", () => {
    expect(isDelayed({ ...base, lastRunAt: "2026-10-25T11:20:00Z" }, now)).toBe(false);
  });
  it("is true after an hour with no run", () => {
    expect(isDelayed({ ...base, lastRunAt: "2026-10-25T10:30:00Z" }, now)).toBe(true);
  });
  it("is never true for sample data or before the first run", () => {
    expect(isDelayed({ ...base, mode: "sample", lastRunAt: "2026-01-01T00:00:00Z" }, now)).toBe(false);
    expect(isDelayed(base, now)).toBe(false);
  });
});
