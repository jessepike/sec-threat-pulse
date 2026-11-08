import { describe, expect, it } from "vitest";
import { bucketWeeks, chartStart } from "./weeks";

describe("bucketWeeks", () => {
  const now = new Date("2026-11-08T12:00:00Z"); // a Sunday; its week starts Mon Nov 2
  it("returns 12 Monday weeks ending with the current one, marked partial", () => {
    const w = bucketWeeks([], now);
    expect(w).toHaveLength(12);
    expect(w[0].week).toBe("2026-08-17");
    expect(w.at(-1)).toEqual({ week: "2026-11-02", count: 0, partial: true });
    expect(chartStart(now)).toBe("2026-08-17");
  });
  it("counts dates into their week and drops dates outside the window", () => {
    const w = bucketWeeks(["2026-11-02", "2026-11-08", "2026-11-01", "2026-08-16", "2026-08-17"], now);
    expect(w.at(-1)!.count).toBe(2);
    expect(w.at(-2)!.count).toBe(1);
    expect(w[0].count).toBe(1);
    expect(w.reduce((n, x) => n + x.count, 0)).toBe(4);
  });
});
