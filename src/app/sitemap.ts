import type { MetadataRoute } from "next";
import { getEventEntries } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGES = ["/", "/events", "/vendors", "/brief", "/methodology", "/track-record", "/trends", "/corrections", "/about", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEventEntries();
  return [
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p === "/" ? "" : p}`, changeFrequency: p === "/" || p === "/events" ? ("hourly" as const) : ("weekly" as const) })),
    ...events.map((e) => ({ url: `${SITE_URL}/events/${e.id}`, lastModified: new Date(e.updatedAt), changeFrequency: "daily" as const })),
  ];
}
