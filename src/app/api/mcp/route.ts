import { createMcpHandler } from "mcp-handler";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { API_NOTICE, STACK_MAX_PRODUCTS, apiEvent, apiEvents, parseApiVerdict, parseStack } from "@/lib/api/v1";
import { cachedBrief, cachedCheckStack } from "@/lib/api/cached";
import { cachedTrackRecord } from "@/lib/track-record/cached";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const listCached = unstable_cache(
  (verdict: string, page: number, product: string, since: string) => apiEvents({ verdict: parseApiVerdict(verdict), page, product: product || null, since: since || null }),
  ["mcp-events"],
  { revalidate: 300, tags: ["stp"] },
);
const eventCached = unstable_cache((id: string) => apiEvent(id), ["mcp-event"], { revalidate: 300, tags: ["stp"] });

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_events",
      {
        title: "List threat events",
        description:
          "Security events with their evidence ladder (talk, exposed, tried, exploited, damage), rule-based verdict (act_now, watch, low), affected products, CVSS, EPSS and KEV dates, newest evidence first. 50 per page.",
        inputSchema: z.object({
          verdict: z.enum(["act_now", "watch", "low"]).optional().describe("Only events with this verdict."),
          product: z.string().min(2).max(80).optional().describe("Only events naming this vendor or product, for example 'Fortinet', 'PAN-OS' or 'fortinet/fortios'."),
          since: z.string().datetime({ offset: true }).optional().describe("Only events updated, or with new evidence, at or after this ISO time. Use it as a changes feed."),
          page: z.number().int().min(1).max(100).optional().describe("Page number, starting at 1."),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ verdict, product, since, page }) => {
        const data = await listCached(verdict ?? "", page ?? 1, product ?? "", since ?? "");
        if (!data) return fail("Data is not available right now.");
        return json({ notice: API_NOTICE, ...data });
      },
    );

    server.registerTool(
      "get_event",
      {
        title: "Get one threat event",
        description: "One event by id: ladder with sources per rung, the clock (disclosure, exploit code, first attack report, KEV listing, deadline), verdict and reason, affected products, CISA's fix when listed, and dated, linked evidence.",
        inputSchema: z.object({ id: z.string().regex(/^[a-z0-9-]{3,120}$/).describe("Event id from list_events or search_events.") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ id }) => {
        const data = await eventCached(id);
        if (data === null) return fail("Data is not available right now.");
        if (data === false) return fail(`No event with id ${id}.`);
        return json({ notice: API_NOTICE, event: data });
      },
    );

    server.registerTool(
      "search_events",
      {
        title: "Search threat events",
        description: "Find events by CVE id, vendor or product name, for example 'CVE-2026-0322', 'Ivanti' or 'SharePoint'. Returns up to 20 matches.",
        inputSchema: z.object({ query: z.string().min(2).max(100) }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ query }) => {
        const q = query.trim().toLowerCase();
        const matches = [];
        for (let page = 1; page <= 20 && matches.length < 20; page++) {
          const data = await listCached("", page, "", "");
          if (!data) return fail("Data is not available right now.");
          for (const e of data.events) {
            const hay = [e.title, e.vendor, e.product, ...e.cves, ...e.affectedProducts.map((p) => `${p.vendor} ${p.product} ${p.slug}`)].filter(Boolean).join(" ").toLowerCase();
            if (hay.includes(q)) matches.push(e);
          }
          if (page >= data.pages) break;
        }
        return json({ notice: API_NOTICE, query, matches: matches.slice(0, 20) });
      },
    );

    server.registerTool(
      "get_brief",
      {
        title: "Get this week's short list",
        description:
          "The week's top five: up to five Act now events in rank order (verdict, Act today tier, ranking score, newest evidence), each with why it ranks there and the first step, plus one sentence for the week from fixed templates. The same list the home page leads with. Start here.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => {
        const data = await cachedBrief();
        if (!data) return fail("Data is not available right now.");
        return json({ notice: API_NOTICE, ...data });
      },
    );

    server.registerTool(
      "check_stack",
      {
        title: "Check a list of vendors or products",
        description: `Give the vendors or products an organization uses (up to ${STACK_MAX_PRODUCTS}, for example ['Fortinet', 'PAN-OS', 'Microsoft Exchange']). For each one, the Act now and Watch events that name it, in rank order, up to 10 each.`,
        inputSchema: z.object({ products: z.array(z.string().min(2).max(80)).min(1).max(STACK_MAX_PRODUCTS) }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ products }) => {
        const clean = parseStack(products.join(","));
        if (!clean) return fail("Each product must be 2 to 80 letters, digits, spaces or . & / + - characters.");
        const data = await cachedCheckStack(clean);
        if (!data) return fail("Data is not available right now.");
        return json({ notice: API_NOTICE, products: clean, ...data });
      },
    );

    server.registerTool(
      "get_track_record",
      {
        title: "Get the verdict track record",
        description:
          "How often early Act now calls (made before a KEV listing) were right within 30 days: the live record since history began and the backtest for every rules version, with right, wrong and pending counts, 95% intervals, lead time before KEV and every scored call. Read it before relying on a verdict.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => {
        const data = await cachedTrackRecord();
        if (!data) return fail("Data is not available right now.");
        return json({ notice: API_NOTICE, page: "https://securitythreatpulse.com/track-record", ...data });
      },
    );
  },
  { serverInfo: { name: "security-threat-pulse", version: "1.0.0" } },
);

export { handler as GET, handler as POST, handler as DELETE };
