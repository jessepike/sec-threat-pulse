import { describe, expect, it } from "vitest";
import { categorize } from "./category";

const cases: [string, string, string][] = [
  ["Ivanti", "Connect Secure", "edge"],
  ["Palo Alto Networks", "PAN-OS", "edge"],
  ["Citrix", "NetScaler ADC and NetScaler Gateway", "edge"],
  ["SonicWall", "SMA1000 Appliances", "edge"],
  ["Cisco", "Secure Email Gateway", "email"],
  ["ConnectWise", "ScreenConnect", "remote-it"],
  ["BeyondTrust", "Remote Support", "remote-it"],
  ["N-able", "N-central", "remote-it"],
  ["Fortra", "GoAnywhere MFT", "file-transfer"],
  ["Progress", "ShareFile Storage Zones Controller", "file-transfer"],
  ["Microsoft", "SharePoint", "collaboration"],
  ["Cisco", "Identity Services Engine", "identity"],
  ["GitLab", "Community Edition and Enterprise Edition", "developer"],
  ["JFrog", "Artifactory", "developer"],
  ["BerriAI", "LiteLLM", "ai"],
  ["Acronis", "Backup", "server-backup"],
  ["Microsoft", "SQL Server", "server-backup"],
  ["MikroTik", "RouterOS", "network-device"],
  ["TBK", "DVR-4104", "network-device"],
  ["WordPress", "Core", "website"],
  ["PHP Group", "PHP", "website"],
  ["vercel", "next.js", "website"],
  ["Microsoft", "Windows", "endpoint"],
  ["Google", "Chromium V8", "endpoint"],
  ["Linux", "Kernel", "endpoint"],
  ["PaperCut", "NG/MF", "business-app"],
  ["Unknown Co", "Thing", "other"],
];

describe("categorize", () => {
  it.each(cases)("%s %s is %s", (vendor, product, id) => {
    expect(categorize(vendor, product).id).toBe(id);
  });
  it("gives every known category a first step", () => {
    expect(categorize(null, null).doThis).toContain("Find out if you use it");
  });
});
