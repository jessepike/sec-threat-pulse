import { describe, expect, it } from "vitest";
import { classifyFlaw, plainTitle, productName } from "./plain-title";

describe("classifyFlaw", () => {
  it("reads outcomes from the wording", () => {
    expect(classifyFlaw("Ivanti Connect Secure Authentication Bypass Vulnerability")).toBe("auth");
    expect(classifyFlaw("Microsoft Windows Win32k Privilege Escalation Vulnerability")).toBe("privilege");
    expect(classifyFlaw("RCE via OOM corruption")).toBe("code");
    expect(classifyFlaw("Fortinet FortiOS OS Command Injection Vulnerability")).toBe("command");
  });
  it("prefers a stated outcome over a root-cause CWE", () => {
    expect(classifyFlaw("An out-of-bounds write allows remote code execution", ["CWE-787"])).toBe("code");
    expect(classifyFlaw(["VMware ESXi OpenSLP Heap-Based Buffer Overflow Vulnerability", "allows remote code execution"])).toBe("code");
  });
  it("trusts the source's own name over its description", () => {
    expect(classifyFlaw(["Zoho ManageEngine Authentication Bypass Vulnerability", "can lead to remote code execution"])).toBe("auth");
    expect(classifyFlaw(["VMware vCenter Server Information Disclosure Vulnerability", "an unauthenticated access path"])).toBe("leak");
    expect(classifyFlaw(["Zyxel Multiple Products Use of Hard-Coded Credentials Vulnerability"])).toBe("auth");
  });
  it("falls back to the CWE, then to unknown", () => {
    expect(classifyFlaw("A flaw in the parser", ["CWE-22"])).toBe("files");
    expect(classifyFlaw("A flaw in the parser")).toBe("unknown");
  });
  it("does not read 'dos' inside other words", () => {
    expect(classifyFlaw("Windows Defender bypass")).toBe("unknown");
  });
});

describe("productName", () => {
  it("drops a vendor the product already names and junk values", () => {
    expect(productName("Ivanti", "Ivanti Connect Secure")).toBe("Ivanti Connect Secure");
    expect(productName("Microsoft", "Windows")).toBe("Microsoft Windows");
    expect(productName("n/a", "n/a")).toBe("");
    expect(productName("php", "php")).toBe("PHP");
    expect(productName("PHP Group", "PHP")).toBe("PHP");
    expect(productName("VMware", "Multiple Products")).toBe("Several VMware products");
  });
});

describe("plainTitle", () => {
  it("names the product and what an attacker can do", () => {
    expect(plainTitle({ vendor: "Citrix", product: "NetScaler ADC", texts: ["Citrix NetScaler ADC Code Injection Vulnerability"] })).toBe(
      "Citrix NetScaler ADC: attackers can run their own code",
    );
  });
  it("says 'reported' for early events and stays plain when the type is unknown", () => {
    expect(plainTitle({ vendor: "Acme", product: "Router", texts: ["Unspecified vulnerability"], confirmed: false })).toBe("Acme Router: security flaw reported in attacks");
  });
  it("counts grouped flaws", () => {
    expect(plainTitle({ vendor: "Cisco", product: "IOS XE", texts: ["privilege escalation"], count: 3 })).toBe(
      "Cisco IOS XE: 3 flaws used in attacks; attackers can gain admin rights",
    );
  });
  it("keeps grouped memory flaws short and drops long dashes", () => {
    expect(plainTitle({ vendor: "Linux", product: "Kernel", texts: ["use-after-free"], count: 3 })).toBe("Linux Kernel: 3 memory flaws used in attacks");
    expect(productName("Collabora", "Collabora Online – Built-in CODE Server")).toBe("Collabora Online, Built-in CODE Server");
  });
  it("uses the fallback name when the product is unknown but the flaw type is clear", () => {
    expect(plainTitle({ texts: ["allows attackers to execute arbitrary commands"], fallbackName: "CVE-2023-38646" })).toBe("CVE-2023-38646: attackers can run commands on it");
    expect(plainTitle({ texts: ["Unspecified issue"], fallbackName: "CVE-2023-1" })).toBe("");
    expect(productName("ivanti", "connect_secure")).toBe("Ivanti Connect Secure");
  });
  it("returns empty without a product, so callers keep the source title", () => {
    expect(plainTitle({ vendor: "", product: null, texts: ["RCE"] })).toBe("");
  });
});
