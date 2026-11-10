import { Hero, MainShell, Mission, MoreLinks, Steps } from "@/components/home";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeStrip } from "@/components/StatusStrip";
import { KevWeeks } from "@/components/KevWeeks";
import { getHomeData } from "@/lib/data";

export const revalidate = 1800;

/**
 * The home page answers one question: what do I do first. The top list, the counts, what changed
 * this week and one live chart. Every other event is on /events; report figures are on /trends.
 */
export default async function HomePage() {
  const data = await getHomeData();
  return (
    <>
      <SiteHeader active="week" strip={<HomeStrip status={data.status} />} />
      <MainShell>
        <Mission />
        <Hero data={data} />
        <Steps steps={data.actions} />
        <KevWeeks weeks={data.kevWeeks} />
        <MoreLinks total={data.counts.total} />
      </MainShell>
    </>
  );
}
