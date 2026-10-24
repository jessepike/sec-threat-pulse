import { describe, expect, it } from "vitest";
import { extractCves, mapLimit, parseCsv, parseCsvObjects, pickBatch, sortCvesNewest, usDateToIso } from "./util";

describe("util", () => {
  it("extracts and dedupes CVE ids", () => {
    expect(extractCves(["CVE-2021-44228", "OSVDB-1", "cve-2021-44228;CVE-2014-0160"])).toEqual(["CVE-2021-44228", "CVE-2014-0160"]);
    expect(extractCves(undefined)).toEqual([]);
  });

  it("parses quoted CSV with commas, quotes and newlines", () => {
    const rows = parseCsv('a,b\n"x, y","he said ""hi"""\r\n"multi\nline",z\n');
    expect(rows).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["multi\nline", "z"]]);
    expect(parseCsvObjects("h1,h2\n1,2\n")).toEqual([{ h1: "1", h2: "2" }]);
  });

  it("parses US dates", () => {
    expect(usDateToIso("10/22/2026")).toBe("2026-10-22T00:00:00.000Z");
    expect(usDateToIso("nope")).toBeUndefined();
  });

  it("limits concurrency and keeps order", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(2);
  });

  it("rotates batches through the tail", () => {
    const list = [1, 2, 3, 4, 5, 6, 7];
    const a = pickBatch(list, 0, 2, 2);
    expect(a.batch).toEqual([1, 2, 3, 4]);
    const b = pickBatch(list, a.nextOffset, 2, 2);
    expect(b.batch).toEqual([1, 2, 5, 6]);
    const c = pickBatch(list, b.nextOffset, 2, 2);
    expect(c.batch).toEqual([1, 2, 7, 3]);
  });

  it("sorts CVEs newest first", () => {
    expect(sortCvesNewest(["CVE-2020-1000", "CVE-2026-5", "CVE-2026-10"])).toEqual(["CVE-2026-10", "CVE-2026-5", "CVE-2020-1000"]);
  });
});
