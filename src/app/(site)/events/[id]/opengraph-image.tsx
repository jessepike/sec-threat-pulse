import { getEvent } from "@/lib/data";
import { RUNGS } from "@/lib/ladder/types";
import { renderEventOgImage, renderOgImage } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} event`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getEvent(id).catch(() => null);
  if (!found) return renderOgImage();
  const e = found.event;
  return renderEventOgImage({
    title: e.title,
    verdict: e.verdict,
    ids: e.cves.slice(0, 3).join(" · ") || e.idsLabel,
    states: RUNGS.map((r) => (e.ladder[r] === "confirmed" || e.ladder[r] === "reported" ? e.ladder[r] : "none")),
  });
}
