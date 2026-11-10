// Vendor pages: every vendor named by an event's affected products, with its events and counts. Pure.

import type { Verdict } from "@/lib/ladder/types";
import { normKey, productFamily } from "@/lib/products";

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
  /**
   * Product families named under this vendor, most events first. Versions and model variants of
   * one product are one entry. `slug` is the value for /events?product=.
   */
  products: { slug: string; label: string; events: number; embedded: boolean }[];
  /** Event ids in the order given (display order). */
  eventIds: string[];
  /** Act now and Watch event ids, so totals across several vendors count each event once. */
  actNowIds: string[];
  watchIds: string[];
}

export const VENDOR_KEY_RE = /^[a-z0-9]{2,60}$/;

/** A product filter value the /events page accepts as written. */
const QUERY_OK = /^[\w .&/+-]{1,80}$/;

/**
 * Groups events by the vendors their products name. An event naming two products of one vendor
 * counts once, and so does an event naming two versions of one product family.
 */
export function groupVendors(items: VendorItem[]): VendorSummary[] {
  type Prod = VendorSummary["products"][number] & { ids: Set<string> };
  const by = new Map<string, VendorSummary & { productMap: Map<string, Prod> }>();
  for (const it of items) {
    const seen = new Set<string>();
    for (const p of it.products) {
      if (!VENDOR_KEY_RE.test(p.vendorKey)) continue;
      const v = by.get(p.vendorKey) ?? { key: p.vendorKey, name: p.vendor, actNow: 0, watch: 0, low: 0, total: 0, products: [] as Prod[], eventIds: [] as string[], actNowIds: [] as string[], watchIds: [] as string[], productMap: new Map<string, Prod>() };
      by.set(p.vendorKey, v);
      const family = productFamily(p.label);
      const familyKey = normKey(family) || p.slug;
      // A family of one keeps its exact slug. A family label is used as the filter only when the filter accepts it.
      const prod = v.productMap.get(familyKey) ?? { slug: p.slug, label: family, events: 0, embedded: p.kind === "embedded", ids: new Set<string>() };
      if (prod.slug !== p.slug && QUERY_OK.test(family)) prod.slug = family;
      if (p.kind === "direct") prod.embedded = false;
      prod.ids.add(it.id);
      prod.events = prod.ids.size;
      v.productMap.set(familyKey, prod);
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
    .map(({ productMap, ...v }) => ({
      ...v,
      products: [...productMap.values()].map(({ ids: _ids, ...prod }) => (void _ids, prod)).sort((a, b) => b.events - a.events || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => b.actNow - a.actNow || b.watch - a.watch || b.total - a.total || a.name.localeCompare(b.name));
}

/** True when a stack entry names this vendor. "paloalto" finds "paloaltonetworks": 4 or more letters also match the start of a key. */
export function stackHit(entry: string, vendorKey: string): boolean {
  return vendorKey === entry || (entry.length >= 4 && vendorKey.startsWith(entry));
}

/** The address for a list of vendor keys. No keys is the plain page. */
export function stackHref(keys: string[]): string {
  return keys.length ? `/vendors?stack=${keys.join(",")}` : "/vendors";
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
