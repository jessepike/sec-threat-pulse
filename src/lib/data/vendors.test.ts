import { describe, expect, it } from "vitest";
import { groupVendors, parseVendorStack, type VendorProductRef } from "./vendors";

const p = (vendorKey: string, product: string, kind: "direct" | "embedded" = "direct"): VendorProductRef => ({ vendorKey, vendor: vendorKey.toUpperCase(), slug: `${vendorKey}/${product}`, label: `${vendorKey} ${product}`, kind });

describe("groupVendors", () => {
  const vs = groupVendors([
    { id: "a", verdict: "act_now", products: [p("fortinet", "fortios"), p("fortinet", "fortiproxy")] },
    { id: "b", verdict: "watch", products: [p("fortinet", "fortios"), p("ivanti", "epmm")] },
    { id: "c", verdict: "act_now", products: [p("ivanti", "connectsecure"), p("cisco", "asa", "embedded")] },
    { id: "d", verdict: "low", products: [p("x", "bad")] },
  ]);
  it("counts each event once per vendor and keeps display order", () => {
    const f = vs.find((v) => v.key === "fortinet")!;
    expect(f).toMatchObject({ actNow: 1, watch: 1, total: 2, eventIds: ["a", "b"] });
    expect(f.products.map((x) => [x.slug, x.events])).toEqual([["fortinet/fortios", 2], ["fortinet/fortiproxy", 1]]);
  });
  it("sorts vendors by Act now, Watch, total, then name, and drops bad keys", () => {
    expect(vs.map((v) => v.key)).toEqual(["fortinet", "ivanti", "cisco"]);
    expect(vs.find((v) => v.key === "cisco")!.products[0].embedded).toBe(true);
  });
});

describe("parseVendorStack", () => {
  it("keeps clean vendor keys, once each", () => {
    expect(parseVendorStack("Fortinet, palo-alto,fortinet,<x>")).toEqual(["fortinet", "paloalto"]);
    expect(parseVendorStack(undefined)).toEqual([]);
  });
});
