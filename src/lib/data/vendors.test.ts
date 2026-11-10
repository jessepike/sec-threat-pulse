import { describe, expect, it } from "vitest";
import { groupVendors, parseVendorStack, stackHit, stackHref, stackTotals, type VendorProductRef } from "./vendors";

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

describe("stackTotals", () => {
  it("counts an event that names two chosen vendors once", () => {
    const vs = groupVendors([
      { id: "a", verdict: "act_now", products: [p("fortinet", "fortios")] },
      { id: "b", verdict: "watch", products: [p("fortinet", "fortios"), p("ivanti", "epmm")] },
    ]);
    expect(stackTotals(vs)).toEqual({ actNow: 1, watch: 1 });
  });
});

describe("parseVendorStack", () => {
  it("keeps clean vendor keys, once each", () => {
    expect(parseVendorStack("Fortinet, palo-alto,fortinet,<x>")).toEqual(["fortinet", "paloaltonetworks"]);
    expect(parseVendorStack(undefined)).toEqual([]);
    expect(parseVendorStack("netscaler,citrix,aristanetworks")).toEqual(["citrix", "arista"]);
  });
});

describe("product families", () => {
  const ref = (label: string, slug: string): VendorProductRef => ({ vendorKey: "microsoft", vendor: "Microsoft", slug, label, kind: "direct" });
  it("rolls versions of one product into one entry and counts each event once", () => {
    const [v] = groupVendors([
      { id: "a", verdict: "act_now", products: [ref("Microsoft Windows 10 Version 1607", "microsoft/w1607"), ref("Microsoft Windows 10 Version 1809", "microsoft/w1809")] },
      { id: "b", verdict: "watch", products: [ref("Microsoft Windows 10 Version 1809", "microsoft/w1809"), ref("Microsoft Exchange Server", "microsoft/exchange")] },
    ]);
    expect(v.products).toEqual([
      { slug: "Microsoft Windows 10", label: "Microsoft Windows 10", events: 2, embedded: false },
      { slug: "microsoft/exchange", label: "Microsoft Exchange Server", events: 1, embedded: false },
    ]);
  });
});

describe("stack helpers", () => {
  it("matches a key or the start of a longer key, and builds the address", () => {
    expect(stackHit("paloalto", "paloaltonetworks")).toBe(true);
    expect(stackHit("hp", "hpe")).toBe(false);
    expect(stackHref(["cisco", "ivanti"])).toBe("/vendors?stack=cisco,ivanti");
    expect(stackHref([])).toBe("/vendors");
  });
});
