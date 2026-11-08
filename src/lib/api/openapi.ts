import { SITE_URL } from "@/lib/site";
import { API_VERSION } from "./v1";

/**
 * OpenAPI 3.1 for the public API. One Event schema is shared by the list, the detail and the MCP
 * tools, so an agent can validate every response against it. Kept by hand: when a field changes in
 * lib/api/v1.ts, change it here in the same pull request (v1.test.ts checks the two agree).
 */

const rungState = { type: "string", enum: ["confirmed", "reported", "none"] } as const;
const dateOnly = { type: "string", format: "date", description: "YYYY-MM-DD" } as const;
const nullable = <T extends object>(schema: T) => ({ oneOf: [schema, { type: "null" }] });

export const SCHEMAS = {
  Verdict: { type: "string", enum: ["act_now", "watch", "low"], description: "From the published rules. Never a model's opinion." },
  Ladder: {
    type: "object",
    description: "The evidence ladder. Each rung is confirmed, reported or none.",
    properties: { talk: rungState, exposure: rungState, attempts: rungState, exploited: rungState, damage: rungState },
    required: ["talk", "exposure", "attempts", "exploited", "damage"],
  },
  AffectedProduct: {
    type: "object",
    properties: {
      vendorKey: { type: "string" },
      productKey: { type: "string" },
      vendor: { type: "string", description: "Display name, for example Fortinet." },
      product: { type: "string", description: "Display name, for example FortiOS. Empty when only the vendor is known." },
      slug: { type: "string", description: "Filter key, for example fortinet/fortios." },
      kind: { type: "string", enum: ["direct", "embedded"], description: "direct: the vulnerable software. embedded: a product that ships the component, from a sourced table." },
      via: { type: "string", description: "For embedded products, the component they ship." },
      ref: { type: "string", format: "uri", description: "For embedded products, the page that names them." },
      evidence: { type: "array", items: { type: "string", enum: ["cpe", "kev", "cna", "table"] } },
    },
    required: ["vendorKey", "productKey", "vendor", "product", "slug", "kind", "evidence"],
  },
  Category: {
    type: "object",
    properties: { id: { type: "string" }, label: { type: "string" }, why: { type: "string" }, doThis: { type: "string" } },
    required: ["id", "label", "why", "doThis"],
  },
  ClockPoint: {
    type: "object",
    properties: { date: dateOnly, label: { type: "string", description: "What set the date." }, url: { type: "string", format: "uri" } },
    required: ["date", "label"],
  },
  Clock: {
    type: "object",
    description: "Dates practitioners rank by. A missing key means the date is not known.",
    properties: {
      disclosed: { $ref: "#/components/schemas/ClockPoint" },
      exploitCode: { $ref: "#/components/schemas/ClockPoint" },
      firstReport: { $ref: "#/components/schemas/ClockPoint" },
      kevListed: { $ref: "#/components/schemas/ClockPoint" },
      kevDue: { $ref: "#/components/schemas/ClockPoint" },
      daysToFirstReport: { type: "integer" },
      daysToKev: { type: "integer" },
    },
  },
  Evidence: {
    type: "object",
    properties: {
      rung: { type: "string" },
      strength: { type: "string", enum: ["confirmed", "reported", "claimed", "quoted"] },
      title: { type: "string" },
      url: { type: "string", format: "uri" },
      publishedAt: nullable({ type: "string", format: "date-time" }),
      source: { type: "object", properties: { id: { type: "string" }, name: nullable({ type: "string" }), attribution: nullable({ type: "string" }) }, required: ["id"] },
    },
    required: ["rung", "strength", "title", "url", "publishedAt", "source"],
  },
  Event: {
    type: "object",
    properties: {
      id: { type: "string", description: "Stable slug. Early (pre-listing) events start with early-." },
      url: { type: "string", format: "uri" },
      title: { type: "string" },
      verdict: { $ref: "#/components/schemas/Verdict" },
      verdictReason: nullable({ type: "string" }),
      tier: nullable({ type: "string", enum: ["today", "now"], description: "Tier inside Act now. \"today\" is the short list: exploitation confirmed in the last 14 days on an internet-facing product, or with ransomware use or public attack tools. Null below Act now and before rules v3." }),
      rankScore: nullable({ type: "integer", minimum: 0, maximum: 11, description: "Ranking score inside the verdict, higher first. Null before rules v3." }),
      rankWhy: nullable({ type: "array", items: { type: "string" }, description: "One plain line per ranking factor." }),
      rulesVersion: { type: "string" },
      ladder: { $ref: "#/components/schemas/Ladder" },
      cves: { type: "array", items: { type: "string" } },
      vendor: nullable({ type: "string" }),
      product: nullable({ type: "string" }),
      affectedProducts: { type: "array", items: { $ref: "#/components/schemas/AffectedProduct" } },
      category: { $ref: "#/components/schemas/Category" },
      summary: nullable({ type: "string" }),
      cvss: nullable({ type: "number" }),
      epss: nullable({ type: "number", minimum: 0, maximum: 1 }),
      exploitMaturity: { type: "string", enum: ["none", "poc", "weaponized"] },
      kevListed: { type: "boolean" },
      kevDateAdded: nullable(dateOnly),
      kevDueDate: nullable(dateOnly),
      firstSeenAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      newestEvidenceAt: { type: "string", format: "date-time" },
    },
    required: ["id", "url", "title", "verdict", "verdictReason", "tier", "rankScore", "rankWhy", "rulesVersion", "ladder", "cves", "vendor", "product", "affectedProducts", "category", "summary", "cvss", "epss", "exploitMaturity", "kevListed", "kevDateAdded", "kevDueDate", "firstSeenAt", "updatedAt", "newestEvidenceAt"],
  },
  EventDetail: {
    allOf: [
      { $ref: "#/components/schemas/Event" },
      {
        type: "object",
        properties: {
          fix: nullable({ type: "string" }),
          clock: { $ref: "#/components/schemas/Clock" },
          ladderSources: { type: "object", additionalProperties: { type: "integer" }, description: "Distinct sources behind each rung." },
          evidence: { type: "array", items: { $ref: "#/components/schemas/Evidence" } },
          evidenceWithheld: { type: "integer", description: "Evidence items left out because their source's terms do not allow re-serving." },
        },
        required: ["fix", "clock", "ladderSources", "evidence", "evidenceWithheld"],
      },
    ],
  },
} as const;

/** Fields the Event schema requires. v1.test.ts checks every one is produced by the API. */
export const EVENT_REQUIRED_FIELDS: readonly string[] = SCHEMAS.Event.required;

const envelope = (extra: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: {
    apiVersion: { type: "string" },
    notice: { type: "string" },
    generatedAt: { type: "string", format: "date-time" },
    ...extra,
  },
  required: ["apiVersion", "notice", "generatedAt", ...required],
});

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Security Threat Pulse API",
      version: API_VERSION,
      summary: "Facts with sources; verdicts from published rules. Free, no key. Not advice.",
      description:
        "Every event sits on a five-rung evidence ladder. Verdicts (act_now, watch, low) come from versioned rules at " +
        `${SITE_URL}/methodology. Security Threat Pulse's own fields are CC BY 4.0 (attribute as "Security Threat Pulse, ${SITE_URL}"); ` +
        "evidence keeps each source's terms, and sources whose terms do not allow re-serving are withheld and counted. " +
        `Check ${SITE_URL}/status.json before trusting a reading. Responses are cached for five minutes.`,
      contact: { name: "Security Threat Pulse", url: `${SITE_URL}/about` },
      license: { name: "CC BY 4.0 (STP fields)", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    servers: [{ url: SITE_URL }],
    paths: {
      "/api/v1/events": {
        get: {
          operationId: "listEvents",
          summary: "Events in display order: Act now first, newest evidence first within a verdict.",
          parameters: [
            { name: "verdict", in: "query", schema: { $ref: "#/components/schemas/Verdict" } },
            { name: "product", in: "query", schema: { type: "string", maxLength: 80 }, description: "Vendor, product, label or slug, for example fortinet/fortios or PAN-OS. Matches affectedProducts." },
            { name: "cve", in: "query", schema: { type: "string", pattern: "^CVE-\\d{4}-\\d{4,}$" } },
            { name: "since", in: "query", schema: { type: "string", format: "date-time" }, description: "Only events updated, or with new evidence, at or after this time. A changes feed." },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "50 events a page." },
          ],
          responses: {
            "200": {
              description: "One page of events.",
              content: {
                "application/json": {
                  schema: envelope(
                    {
                      filters: { type: "object" },
                      total: { type: "integer" },
                      page: { type: "integer" },
                      pages: { type: "integer" },
                      events: { type: "array", items: { $ref: "#/components/schemas/Event" } },
                    },
                    ["total", "page", "pages", "events"],
                  ),
                },
              },
            },
            "400": { description: "A filter value is malformed. The body says which." },
            "503": { description: "Data is not available right now." },
          },
        },
      },
      "/api/v1/events/{id}": {
        get: {
          operationId: "getEvent",
          summary: "One event with its clock, source counts, CISA's fix and dated, linked evidence.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9-]{3,120}$" } }],
          responses: {
            "200": { description: "The event.", content: { "application/json": { schema: envelope({ event: { $ref: "#/components/schemas/EventDetail" } }, ["event"]) } } },
            "404": { description: "Unknown event id." },
            "503": { description: "Data is not available right now." },
          },
        },
      },
      "/api/v1/health": {
        get: {
          operationId: "getHealth",
          summary: "Last complete run, last attempt, per-source health, rules version and counts. Same document at /status.json.",
          responses: { "200": { description: "The site is ok or delayed." }, "503": { description: "The site is down: no complete run on record." } },
        },
      },
    },
    components: { schemas: SCHEMAS },
  };
}
