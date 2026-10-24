import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  serial,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** One row per source in the registry. */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(), // e.g. "cisa-kev"
  name: text("name").notNull(),
  category: text("category").notNull(),
  homepage: text("homepage").notNull(),
  termsStatus: text("terms_status").notNull().default("unclear"), // open | attribution | approval_needed | blocked | unclear
  attribution: text("attribution"),
  enabled: boolean("enabled").notNull().default(true),
  intervalMinutes: integer("interval_minutes").notNull().default(120),
  cursor: text("cursor"),
  lastRunAt: ts("last_run_at"),
  lastSuccessAt: ts("last_success_at"),
  lastError: text("last_error"),
});

/** Every ingest run, success or failure. Powers freshness and the Pipeline runs page. */
export const sourceRuns = pgTable(
  "source_runs",
  {
    id: serial("id").primaryKey(),
    sourceId: text("source_id").notNull().references(() => sources.id),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    status: text("status").notNull().default("running"), // running | ok | error
    itemsFetched: integer("items_fetched").notNull().default(0),
    itemsNew: integer("items_new").notNull().default(0),
    payloadSha256: text("payload_sha256"),
    rawObjectKey: text("raw_object_key"),
    error: text("error"),
  },
  (t) => [index("source_runs_source_idx").on(t.sourceId, t.startedAt)],
);

/** Merged facts per CVE from all sources. */
export const vulnerabilities = pgTable(
  "vulnerabilities",
  {
    cveId: text("cve_id").primaryKey(),
    title: text("title"),
    description: text("description"),
    vendor: text("vendor"),
    product: text("product"),
    cvssScore: real("cvss_score"),
    cwe: jsonb("cwe").$type<string[]>(),
    publishedAt: ts("published_at"),
    epss: real("epss"),
    epssPercentile: real("epss_percentile"),
    epssDate: text("epss_date"),
    kevCisaDateAdded: text("kev_cisa_date_added"),
    kevCisaRansomware: boolean("kev_cisa_ransomware"),
    kevVulncheckDateAdded: text("kev_vulncheck_date_added"),
    exploitMaturity: text("exploit_maturity").notNull().default("none"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("vulnerabilities_kev_cisa_idx").on(t.kevCisaDateAdded), index("vulnerabilities_kev_vulncheck_idx").on(t.kevVulncheckDateAdded)],
);

/** One piece of evidence. Immutable once written; history powers backtests. */
export const observations = pgTable(
  "observations",
  {
    id: serial("id").primaryKey(),
    sourceId: text("source_id").notNull().references(() => sources.id),
    runId: integer("run_id").references(() => sourceRuns.id),
    dedupeKey: text("dedupe_key").notNull().unique(),
    kind: text("kind").notNull(),
    strength: text("strength").notNull(),
    cveIds: jsonb("cve_ids").$type<string[]>().notNull().default([]),
    vendor: text("vendor"),
    product: text("product"),
    orgName: text("org_name"),
    eventId: text("event_id"),
    title: text("title").notNull(),
    summary: text("summary"),
    url: text("url").notNull(),
    publishedAt: ts("published_at"),
    observedAt: ts("observed_at").notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [index("observations_event_idx").on(t.eventId), index("observations_observed_idx").on(t.observedAt), index("observations_cve_ids_idx").using("gin", t.cveIds)],
);

/** A real-world issue: usually a group of related CVEs, later also breaches and campaigns. */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(), // slug, e.g. "php2shell" or "kev-2026-10-20-plex"
    title: text("title").notNull(),
    summary: text("summary"),
    kind: text("kind").notNull().default("vulnerability"),
    vendor: text("vendor"),
    product: text("product"),
    ladder: jsonb("ladder").$type<Record<string, string>>().notNull(),
    exploitMaturity: text("exploit_maturity").notNull().default("none"),
    verdict: text("verdict").notNull().default("low"),
    verdictReason: text("verdict_reason"),
    rulesVersion: text("rules_version").notNull(),
    overrideVerdict: text("override_verdict"),
    overrideReason: text("override_reason"),
    hidden: boolean("hidden").notNull().default(false),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("events_updated_idx").on(t.updatedAt)],
);

export const eventCves = pgTable(
  "event_cves",
  {
    eventId: text("event_id").notNull().references(() => events.id),
    cveId: text("cve_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.cveId] })],
);

/** Every verdict or ladder change. Feeds the track record and the backtest. */
export const verdictHistory = pgTable("verdict_history", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  verdict: text("verdict").notNull(),
  ladder: jsonb("ladder").$type<Record<string, string>>().notNull(),
  rulesVersion: text("rules_version").notNull(),
  reason: text("reason"),
  actor: text("actor").notNull().default("rules"), // rules | admin:<login>
  changedAt: ts("changed_at").notNull().defaultNow(),
});

/** Public corrections log. Append-only. */
export const corrections = pgTable("corrections", {
  id: serial("id").primaryKey(),
  eventId: text("event_id"),
  text: text("text").notNull(),
  actor: text("actor").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Every admin action. Append-only. */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  at: ts("at").notNull().defaultNow(),
});

/** Site settings (default theme, feature flags, alert recipients). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Editor-written (or AI-drafted, then reviewed) plain-language sections for an event page. */
export const eventNarratives = pgTable("event_narratives", {
  eventId: text("event_id").primaryKey().references(() => events.id),
  businessExposure: text("business_exposure"),
  whyAct: text("why_act"),
  fix: text("fix"),
  /** One question per line. The first line shows in the home table. */
  askYourTeam: text("ask_your_team"),
  roles: jsonb("roles").$type<{ ciso: string[]; cio: string[]; ceo: string[]; board: string[] }>().notNull().default({ ciso: [], cio: [], ceo: [], board: [] }),
  claimChecks: jsonb("claim_checks").$type<{ claim: string; truth: string; rating: "TRUE" | "OVERSTATED" | "TOO EARLY" | "FALSE" }[]>().notNull().default([]),
  source: text("source").notNull().default("human"), // human | ai_draft
  status: text("status").notNull().default("draft"), // draft | published
  updatedBy: text("updated_by").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
