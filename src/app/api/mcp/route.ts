import { createMcpHandler } from "mcp-handler";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { API_NOTICE, apiEvent, apiEvents, parseApiVerdict } from "@/lib/api/v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const listCached = unstable_cache((verdict: string, page: number) => apiEvents({ verdict: parseApiVerdict(verdict), page }), ["mcp-events"], { revalidate: 300, tags: ["stp"] });
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
          "Security events with their evidence ladder (talk, exposed, tried, exploited, damage) and rule-based verdict (act_now, watch, low), newest evidence first. 50 per page.",
        inputSchema: z.object({
          verdict: z.enum(["act_now", "watch", "low"]).optional().describe("Only events with this verdict."),
          page: z.number().int().min(1).max(100).optional().describe("Page number, starting at 1."),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ verdict, page }) => {
        const data = await listCached(verdict ?? "", page ?? 1);
        if (!data) return fail("Data is not available right now.");
        return json({ notice: API_NOTICE, ...data });
      },
    );

    server.registerTool(
      "get_event",
      {
        title: "Get one threat event",
        description: "One event by id: ladder, verdict and reason, CISA's fix when listed, and dated, linked evidence.",
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
          const data = await listCached("", page);
          if (!data) return fail("Data is not available right now.");
          for (const e of data.events) {
            const hay = [e.title, e.vendor, e.product, ...e.cves].filter(Boolean).join(" ").toLowerCase();
            if (hay.includes(q)) matches.push(e);
          }
          if (page >= data.pages) break;
        }
        return json({ notice: API_NOTICE, query, matches: matches.slice(0, 20) });
      },
    );
  },
  { serverInfo: { name: "security-threat-pulse", version: "1.0.0" } },
);

export { handler as GET, handler as POST, handler as DELETE };
