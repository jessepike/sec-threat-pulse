import { describe, expect, it } from "vitest";
import { fromCpePairs, matchesProductQuery, productFamily, productLabel, resolveAffectedProducts, stripCorpSuffix, titleToken, vendorName } from "./resolve";

describe("names", () => {
  it("title-cases CPE tokens and keeps written names", () => {
    expect(titleToken("ios_xe")).toBe("IOS XE");
    expect(titleToken("media_server")).toBe("Media Server");
    expect(titleToken("PAN-OS")).toBe("PAN-OS");
    expect(titleToken("backup_\\&_replication")).toBe("Backup & Replication");
  });
  it("maps vendor tokens and aliases to one display name", () => {
    expect(vendorName("paloaltonetworks")).toBe("Palo Alto Networks");
    expect(vendorName("Palo Alto Networks")).toBe("Palo Alto Networks");
    expect(vendorName("pulsesecure")).toBe("Ivanti");
    expect(vendorName("acme_widgets")).toBe("Acme Widgets");
  });
});

describe("resolveAffectedProducts", () => {
  it("merges the same product from KEV, the CVE record and CPE into one entry", () => {
    const out = resolveAffectedProducts([
      { vendor: "Fortinet", product: "FortiOS", evidence: "kev" },
      { vendor: "Fortinet", product: "FortiOS", evidence: "cna" },
      ...fromCpePairs(["fortinet/fortios", "fortinet/fortiproxy"]),
    ]);
    expect(out.map((p) => [p.slug, p.product, p.kind])).toEqual([
      ["fortinet/fortios", "FortiOS", "direct"],
      ["fortinet/fortiproxy", "FortiProxy", "direct"],
    ]);
    expect(out[0].evidence).toEqual(["kev", "cna", "cpe"]);
    expect(out[0].vendor).toBe("Fortinet");
  });

  it("puts human-written names before CPE-only entries and caps the list", () => {
    const out = resolveAffectedProducts([...fromCpePairs(["a/one", "a/two", "a/three"]), { vendor: "a", product: "four", evidence: "kev" }], { max: 2 });
    expect(out.map((p) => p.productKey)).toEqual(["four", "one"]);
  });

  it("drops n/a vendors, wildcard products and a bare vendor when its product is known", () => {
    const out = resolveAffectedProducts([
      { vendor: "n/a", product: "n/a", evidence: "cna" },
      { vendor: "Plex", product: undefined, evidence: "kev" },
      ...fromCpePairs(["plex/media_server", "plex/*"]),
    ]);
    expect(out.map((p) => p.slug)).toEqual(["plex/mediaserver"]);
    expect(out[0].product).toBe("Media Server");
  });

  it("keeps a vendor-only mention when nothing more specific exists", () => {
    const out = resolveAffectedProducts([{ vendor: "Zyxel", product: "*", evidence: "kev" }]);
    expect(out).toEqual([expect.objectContaining({ vendor: "Zyxel", product: "", slug: "zyxel" })]);
  });

  it("adds embedded products from the component table with a reference", () => {
    const out = resolveAffectedProducts(fromCpePairs(["apache/log4j"]));
    expect(out[0]).toMatchObject({ product: "Log4j", kind: "direct" });
    const emb = out.filter((p) => p.kind === "embedded");
    expect(emb.length).toBeGreaterThan(2);
    expect(emb[0]).toMatchObject({ via: "Apache Log4j", product: "VMware Horizon" });
    expect(emb[0].ref).toMatch(/^https:\/\//);
  });

  it("collapses a product named after its vendor and strips _firmware", () => {
    const out = resolveAffectedProducts(fromCpePairs(["crushftp/crushftp", "sonicwall/sma1000_firmware"]));
    expect(productLabel(out[0])).toBe("CrushFTP");
    expect(out[1]).toMatchObject({ product: "SMA 1000", slug: "sonicwall/sma1000" });
    expect(productLabel(out[1])).toBe("SonicWall SMA 1000");
  });
});

describe("matchesProductQuery", () => {
  const products = resolveAffectedProducts([{ vendor: "Palo Alto Networks", product: "PAN-OS", evidence: "kev" }]);
  it("matches vendor, product, slug and label forms", () => {
    for (const q of ["palo alto networks", "PAN-OS", "panos", "paloaltonetworks/panos", "Palo Alto Networks PAN-OS"]) expect(matchesProductQuery(products, q)).toBe(true);
    expect(matchesProductQuery(products, "fortinet")).toBe(false);
    expect(matchesProductQuery(products, "")).toBe(false);
  });
});

describe("vendor aliases and product families", () => {
  it("merges variant vendor names into one vendor", () => {
    expect(vendorName("Arista Networks")).toBe("Arista");
    expect(vendorName("netscaler")).toBe("Citrix");
    expect(vendorName("Citrix Netscaler")).toBe("Citrix");
    expect(vendorName("Zammad GmbH")).toBe("Zammad");
    expect(vendorName("Eg Secure Solutions Inc.")).toBe("EG Secure Solutions");
    expect(vendorName("Huawei Technologies Co., Ltd.")).toBe("Huawei");
    expect(vendorName("PHP Group")).toBe("PHP");
    expect(vendorName("Palo Alto Networks")).toBe("Palo Alto Networks");
  });
  it("strips company suffixes and keeps a name that is only a suffix", () => {
    expect(stripCorpSuffix("Acme Widgets, Inc.")).toBe("Acme Widgets");
    expect(stripCorpSuffix("Acme Co., Ltd.")).toBe("Acme");
    expect(stripCorpSuffix("SAP")).toBe("SAP");
    expect(stripCorpSuffix("AG")).toBe("AG");
  });
  it("names the product family", () => {
    expect(productFamily("Microsoft Windows 10 Version 1607")).toBe("Microsoft Windows 10");
    expect(productFamily("Zyxel Gs1900-10hp Firmware")).toBe("Zyxel Gs1900-10hp");
    expect(productFamily("Siemens Simatic Iot2050 Advanced (6es7647-0ba00-1ya2)")).toBe("Siemens Simatic Iot2050 Advanced");
    expect(productFamily("Linksys E1000 V1")).toBe("Linksys E1000");
    expect(productFamily("Fortinet FortiOS")).toBe("Fortinet FortiOS");
  });
  it("lets the product filter match a family or an alias", () => {
    const list = resolveAffectedProducts([{ vendor: "microsoft", product: "windows_10_version_1607", evidence: "cpe" }]);
    expect(matchesProductQuery(list, "Microsoft Windows 10")).toBe(true);
    // A product stored before the alias existed still matches the family shown under the current name.
    const stored = [{ vendorKey: "aristanetworks", productKey: "eosversion1", vendor: "Arista Networks", product: "EOS Version 1", slug: "aristanetworks/eosversion1", kind: "direct" as const, evidence: ["cna" as const] }];
    expect(matchesProductQuery(stored, "Arista EOS")).toBe(true);
    expect(matchesProductQuery(stored, "arista")).toBe(true);
  });
});
