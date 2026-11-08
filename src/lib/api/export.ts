import type { ApiEventSummary } from "./v1";

/** CC BY 4.0 for STP's own fields; each evidence item keeps its source's terms. Same text as the nightly snapshot. */
export const EXPORT_LICENSE = {
  stpFields: "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Attribute as: Security Threat Pulse, https://securitythreatpulse.com",
  sourceData: "Each evidence item keeps its source's terms; see the attribution on every item. Sources whose terms do not allow re-serving are withheld.",
};
export const LICENSE_LINK_HEADER = '<https://creativecommons.org/licenses/by/4.0/>; rel="license"';

const EXPORT_NAME = /^events-(\d{4}-\d{2}-\d{2}|latest)\.(csv|json)$/;

export type ExportFormat = "csv" | "json";

/** Reads "events-2026-11-08.csv" or "events-latest.json". */
export function parseExportName(file: string): { date: string | "latest"; format: ExportFormat } | null {
  const m = EXPORT_NAME.exec(file);
  if (!m) return null;
  if (m[1] !== "latest" && Number.isNaN(Date.parse(`${m[1]}T00:00:00Z`))) return null;
  return { date: m[1] as string | "latest", format: m[2] as ExportFormat };
}

/** Today's date in UTC, the only day this endpoint can export. Earlier days live on the data branch. */
export const utcDate = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

const RUNGS = ["talk", "exposure", "attempts", "exploited", "damage"] as const;

/** Column order of the CSV export. Arrays are joined with "; ". */
export const EXPORT_COLUMNS: readonly string[] = [
  "id",
  "url",
  "title",
  "verdict",
  "tier",
  "rank_score",
  "rules_version",
  ...RUNGS.map((r) => `ladder_${r}`),
  "untracked_rungs",
  "cves",
  "vendor",
  "product",
  "affected_products",
  "category",
  "cvss",
  "epss",
  "exploit_maturity",
  "kev_listed",
  "kev_date_added",
  "kev_due_date",
  "first_seen_at",
  "updated_at",
  "newest_evidence_at",
  "summary",
];

export function eventToCsvRow(e: ApiEventSummary): (string | number | boolean | null)[] {
  return [
    e.id,
    e.url,
    e.title,
    e.verdict,
    e.tier,
    e.rankScore,
    e.rulesVersion,
    ...RUNGS.map((r) => e.ladder[r] ?? "none"),
    e.untrackedRungs.join("; "),
    e.cves.join("; "),
    e.vendor,
    e.product,
    e.affectedProducts.map((p) => p.slug).join("; "),
    e.category.id,
    e.cvss,
    e.epss,
    e.exploitMaturity,
    e.kevListed,
    e.kevDateAdded,
    e.kevDueDate,
    e.firstSeenAt,
    e.updatedAt,
    e.newestEvidenceAt,
    e.summary,
  ];
}

/** RFC 4180: fields with a comma, quote or line break are quoted, quotes doubled. Null is empty. */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(events: ApiEventSummary[]): string {
  const lines = [EXPORT_COLUMNS.join(","), ...events.map((e) => eventToCsvRow(e).map(csvCell).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}
