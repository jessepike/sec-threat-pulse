// Vendor pages: every vendor named by an event's affected products, with its events and counts. Pure.

import type { Verdict } from "@/lib/ladder/types";

export interface VendorProductRef {
  vendorKey: string;
  vendor: string;
  slug: string;
  label: string;
  kind: "direct" | "embedded";
}

export interface VendorItem {
  id: string;
  verdict: Verdict;
  products: VendorProductRef[];
}

export interface VendorSummary {
  /** URL key, for example "fortinet". */
  key: string;
  name: string;
  actNow: number;
  watch: number;
  low: number;
  total: number;
  /** Products named under this vendor, most events first. */
  products: { slug: string; label: string; events: number; embedded: boolean }[];
  /** Event ids in the order given (display order). */
  eventIds: string[];
  /** Act now and Watch event ids, so totals across several vendors count each event once. */
  actNowIds: string[];
  watchIds: string[];
}

export const VENDOR_KEY_RE = /^[a-z0-9]{2,60}$/;

/** Groups events by the vendors their products name. An event naming two products of one vendor counts once. */
export function groupVendors(items: VendorItem[]): VendorSummary[] {
  type Prod = VendorSummary["products"][number];
  const by = new Map<string, VendorSummary & { productMap: Map<string, Prod> }>();
  for (const it of items) {
    const seen = new Set<string>();
    for (const p of it.products) {
      if (!VENDOR_KEY_RE.test(p.vendorKey)) continue;
      const v = by.get(p.vendorKey) ?? { key: p.vendorKey, name: p.vendor, actNow: 0, watch: 0, low: 0, total: 0, products: [] as Prod[], eventIds: [] as string[], actNowIds: [] as string[], watchIds: [] as string[], productMap: new Map<string, Prod>() };
      by.set(p.vendorKey, v);
      const prod = v.productMap.get(p.slug) ?? { slug: p.slug, label: p.label, events: 0, embedded: p.kind === "embedded" };
      if (p.kind === "direct") prod.embedded = false;
      prod.events += 1;
      v.productMap.set(p.slug, prod);
      if (seen.has(p.vendorKey)) continue;
      seen.add(p.vendorKey);
      v.eventIds.push(it.id);
      v.total += 1;
      if (it.verdict === "act_now") {
        v.actNow += 1;
        v.actNowIds.push(it.id);
      } else if (it.verdict === "watch") {
        v.watch += 1;
        v.watchIds.push(it.id);
      }
      else v.low += 1;
    }
  }
  return [...by.values()]
    .map(({ productMap, ...v }) => ({ ...v, products: [...productMap.values()].sort((a, b) => b.events - a.events || a.label.localeCompare(b.label)) }))
    .sort((a, b) => b.actNow - a.actNow || b.watch - a.watch || b.total - a.total || a.name.localeCompare(b.name));
}

/** Act now and Watch totals across several vendors, each event counted once. */
export function stackTotals(vendors: Pick<VendorSummary, "actNowIds" | "watchIds">[]): { actNow: number; watch: number } {
  return { actNow: new Set(vendors.flatMap((v) => v.actNowIds)).size, watch: new Set(vendors.flatMap((v) => v.watchIds)).size };
}

/** Parses a "your stack" list from the URL: vendor keys, comma-separated, at most 25. */
export function parseVendorStack(raw: string | string[] | undefined): string[] {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return [...new Set((v ?? "").toLowerCase().split(",").map((x) => x.trim().replace(/[^a-z0-9]/g, "")).filter((x) => VENDOR_KEY_RE.test(x)))].slice(0, 25);
}
