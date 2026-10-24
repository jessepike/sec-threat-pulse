import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskYourTeam, ClaimCheck, EventHero, FullLadder, Roles, Sources, Summary, TimelineAndBlast } from "@/components/event";
import { SiteHeader } from "@/components/SiteHeader";
import { EventStrip } from "@/components/StatusStrip";
import { getEvent } from "@/lib/data";
import { pageMeta } from "@/lib/site";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await getEvent(id);
  if (!res) return { title: "Event not found" };
  const { title, summary, updatedAt } = res.event;
  return pageMeta({ title, description: summary || undefined, path: `/events/${id}`, type: "article", modifiedTime: updatedAt });
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const res = await getEvent(id);
  if (!res) notFound();
  const { event: e, status } = res;
  return (
    <>
      <SiteHeader active="events" strip={<EventStrip status={status} updatedAt={e.updatedAt} trackingSince={e.trackingSince} sourceCount={e.sources.length} />} />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 pb-[72px] pt-8 sm:px-6">
        <EventHero e={e} />
        <FullLadder e={e} />
        <Summary e={e} />
        <AskYourTeam e={e} />
        <ClaimCheck e={e} />
        <TimelineAndBlast e={e} />
        <Roles e={e} />
        <Sources e={e} />
      </main>
    </>
  );
}
