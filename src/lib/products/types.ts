/**
 * Affected products: the bridge from CVEs (how sources speak) to products (how readers speak).
 * Every entry is derived from source data (NVD CPE, the KEV catalog, the CVE record) and a
 * hand-kept table in this folder. No model writes it.
 */

export type ProductEvidence = "cpe" | "kev" | "cna" | "table";

export interface AffectedProduct {
  /** Canonical lower-case vendor key, for example "fortinet". */
  vendorKey: string;
  /** Canonical lower-case product key, for example "fortios". */
  productKey: string;
  /** Vendor name as shown, for example "Fortinet". */
  vendor: string;
  /** Product name as shown, for example "FortiOS". */
  product: string;
  /** "vendor/product" slug for filters and URLs. */
  slug: string;
  /**
   * direct: the vulnerable software itself. embedded: a product that ships the vulnerable
   * component inside it, from the component table (each entry carries a reference link).
   */
  kind: "direct" | "embedded";
  /** For embedded products, the component they ship. */
  via?: string;
  /** Reference for an embedded entry (the vendor or CISA page that names the product). */
  ref?: string;
  /** Where the direct mapping came from. */
  evidence: ProductEvidence[];
}
