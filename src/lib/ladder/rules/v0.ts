import type { RulesVersion, VerdictContext, VerdictResult } from "./types";
import type { Ladder } from "../types";

const EDGE_PATTERNS = [
  /\bvpn\b/i, /firewall/i, /gateway/i, /fortigate/i, /fortios/i, /fortiproxy/i, /fortiweb/i, /pan-?os/i,
  /globalprotect/i, /netscaler/i, /citrix adc/i, /secure access/i, /connect secure/i, /policy secure/i,
  /\bivanti\b/i, /big-?ip/i, /sonicwall/i, /\bsma\b/i, /anyconnect/i, /\basa\b/i, /remote desktop/i,
  /\brdp\b/i, /screenconnect/i, /anydesk/i, /teamviewer/i, /remote access/i, /remote support/i,
  /load balancer/i, /\bsd-?wan\b/i, /velocloud/i, /edge router/i, /\brouter\b/i,
];

/** Products that sit on the network edge or give remote access. Matched on vendor and product text. */
export function isEdgeOrRemoteAccess(vendor?: string, product?: string): boolean {
  const text = `${vendor ?? ""} ${product ?? ""}`;
  return EDGE_PATTERNS.some((p) => p.test(text));
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function evaluateV0(ladder: Ladder, ctx: VerdictContext): VerdictResult {
  const weaponized = ctx.exploitMaturity === "weaponized";
  const epss = ctx.epss ?? 0;
  const edge = isEdgeOrRemoteAccess(ctx.vendor, ctx.product);

  if (ladder.exploited === "confirmed") {
    const why: string[] = [];
    if (ctx.kevRansomware) why.push("ransomware groups are known to use it");
    if (weaponized) why.push("ready-made attack tools are public");
    if (epss >= 0.5) why.push(`the exploit prediction score is ${pct(epss)}`);
    if (edge) why.push("it affects a product that faces the internet or gives remote access");
    if (why.length) {
      return { verdict: "act_now", reason: `Attacks are confirmed and ${joinList(why)}.` };
    }
    return { verdict: "watch", reason: "Attacks are confirmed, but we see no sign of ransomware use, public attack tools or a high prediction score yet." };
  }

  if (ladder.exploited === "reported" && weaponized) {
    return { verdict: "act_now", reason: "Attacks are reported and ready-made attack tools are public." };
  }

  if (ladder.exploited === "reported") {
    return { verdict: "watch", reason: "Attacks are reported but not yet confirmed by an authoritative source." };
  }
  if (ladder.attempts !== "none") {
    return { verdict: "watch", reason: `Attack attempts are ${ladder.attempts === "confirmed" ? "confirmed" : "reported"}, with no confirmed exploitation yet.` };
  }
  if (ladder.damage !== "none") {
    return { verdict: "watch", reason: `Damage is ${ladder.damage === "confirmed" ? "confirmed" : "reported"}. Check whether it applies to you.` };
  }
  if (weaponized) {
    return { verdict: "watch", reason: "Ready-made attack tools are public, but no attacks are reported yet." };
  }
  if (epss >= 0.3) {
    return { verdict: "watch", reason: `No attacks are reported, but the exploit prediction score is ${pct(epss)}.` };
  }
  return { verdict: "low", reason: "No confirmed or reported attacks, and no sign of widespread exploit tools." };
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const rulesV0: RulesVersion = { version: "v0", evaluate: evaluateV0 };
