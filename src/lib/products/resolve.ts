import { ACRONYMS, EMBEDDED, PRODUCT_NAMES, VENDOR_NAMES } from "./table";
import type { AffectedProduct, ProductEvidence } from "./types";

/** Lower case, letters and digits only. "Palo Alto Networks" and "paloaltonetworks" share one key. */
export const normKey = (s: string | null | undefined): string => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const SKIP = new Set(["", "na", "none", "unknown", "all", "multiple", "various", "notapplicable"]);

const vendorNames = new Map(Object.entries(VENDOR_NAMES).map(([k, v]) => [normKey(k), v]));
const productNames = new Map(
  Object.entries(PRODUCT_NAMES).map(([k, v]) => {
    const [vendor, product] = k.split("/");
    const display = vendorNames.get(normKey(vendor)) ?? vendor;
    return [`${normKey(display)}/${normKey(product.replace(/_firmware$/i, ""))}`, v];
  }),
);
const embedded = new Map(
  Object.entries(EMBEDDED).map(([k, v]) => {
    const [vendor, product] = k.split("/");
    const display = vendorNames.get(normKey(vendor)) ?? vendor;
    return [`${normKey(display)}/${normKey(product)}`, v];
  }),
);

/** A CPE style token ("ios_xe", "pan-os") becomes a name; a name with capitals is kept as written. */
export function titleToken(raw: string): string {
  const t = raw.trim().replace(/\\(.)/g, "$1");
  if (/[A-Z]/.test(t)) return t.replace(/\s+/g, " ");
  return t
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.replace(/^[a-z]/, (c) => c.toUpperCase())))
    .join(" ");
}

/** Vendor display name for a raw vendor token or name. */
export function vendorName(raw: string): string {
  return vendorNames.get(normKey(raw)) ?? titleToken(raw);
}

export interface ProductInput {
  vendor?: string | null;
  product?: string | null;
  evidence: ProductEvidence;
}

/** Parse "vendor/product" strings (the stored cpes list) into inputs. */
export function fromCpePairs(pairs: readonly string[] | null | undefined): ProductInput[] {
  return (pairs ?? []).map((p) => {
    const i = p.indexOf("/");
    return i < 0 ? { vendor: p, product: undefined, evidence: "cpe" as const } : { vendor: p.slice(0, i), product: p.slice(i + 1), evidence: "cpe" as const };
  });
}

const ORDER: Record<ProductEvidence, number> = { kev: 0, cna: 1, cpe: 2, table: 3 };

/**
 * Canonical affected products from every source mention. Mentions of the same vendor and product
 * (after normalizing) merge into one entry that lists where it was seen. KEV and CVE record names
 * come first because they are human written; CPE entries follow. Then any embedded component table
 * entry adds the products that ship the component, each with its reference link.
 */
export function resolveAffectedProducts(inputs: ProductInput[], opts: { max?: number } = {}): AffectedProduct[] {
  const max = opts.max ?? 12;
  const byKey = new Map<string, AffectedProduct & { order: number; seq: number }>();
  let seq = 0;
  for (const i of inputs) {
    const rawVendor = (i.vendor ?? "").trim();
    const rawProduct = (i.product ?? "").trim();
    if (SKIP.has(normKey(rawVendor)) || rawVendor === "*") continue;
    const vendor = vendorName(rawVendor);
    const vendorKey = normKey(vendor);
    let productKey = normKey(rawProduct.replace(/_firmware$/i, ""));
    if (SKIP.has(productKey) || rawProduct === "*") productKey = "";
    const key = `${vendorKey}/${productKey}`;
    const cur = byKey.get(key);
    if (cur) {
      if (!cur.evidence.includes(i.evidence)) cur.evidence.push(i.evidence);
      cur.order = Math.min(cur.order, ORDER[i.evidence]);
      continue;
    }
    let product = productKey ? (productNames.get(key) ?? titleToken(rawProduct.replace(/_firmware$/i, " firmware"))) : "";
    if (productKey && productKey === vendorKey) product = vendor;
    byKey.set(key, {
      vendorKey,
      productKey,
      vendor,
      product,
      slug: productKey ? key : vendorKey,
      kind: "direct",
      evidence: [i.evidence],
      order: ORDER[i.evidence],
      seq: seq++,
    });
  }
  // A vendor-only mention is dropped when a product of that vendor is also present.
  const withProduct = new Set([...byKey.values()].filter((p) => p.productKey).map((p) => p.vendorKey));
  const direct = [...byKey.values()]
    .filter((p) => p.productKey || !withProduct.has(p.vendorKey))
    .sort((a, b) => a.order - b.order || a.seq - b.seq)
    .slice(0, max)
    .map((p) => {
      const { order: _order, seq: _seq, ...rest } = p;
      void _order;
      void _seq;
      return rest;
    });

  const out: AffectedProduct[] = [...direct];
  for (const p of direct) {
    const comp = embedded.get(p.slug);
    if (!comp) continue;
    for (const name of comp.shipsIn) {
      const slug = `embedded/${normKey(name)}`;
      if (out.some((x) => x.slug === slug)) continue;
      out.push({ vendorKey: "", productKey: normKey(name), vendor: "", product: name, slug, kind: "embedded", via: comp.name, ref: comp.ref, evidence: ["table"] });
    }
  }
  return out;
}

/** "Fortinet FortiOS", or just "FortiOS" when the product name already starts with the vendor. */
export function productLabel(p: Pick<AffectedProduct, "vendor" | "product">): string {
  if (!p.product) return p.vendor;
  if (!p.vendor) return p.product;
  return p.product.toLowerCase().startsWith(p.vendor.toLowerCase()) ? p.product : `${p.vendor} ${p.product}`;
}

/** True when a reader's or an agent's query names this product list: vendor, product, slug or label. */
export function matchesProductQuery(products: readonly AffectedProduct[], query: string): boolean {
  const q = normKey(query);
  if (!q) return false;
  return products.some((p) => p.vendorKey === q || p.productKey === q || normKey(p.slug) === q || normKey(productLabel(p)) === q || normKey(p.product) === q);
}
