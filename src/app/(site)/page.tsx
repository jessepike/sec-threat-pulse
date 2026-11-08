import { Drivers, EventsTable, Hero, KpiStrip, MainShell, Mission, RealNoiseDo, Ransomware } from "@/components/home";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeStrip } from "@/components/StatusStrip";
import { KevWeeks } from "@/components/KevWeeks";
import { getHomeData } from "@/lib/data";

export const revalidate = 300;

export default async function HomePage() {
  const data = await getHomeData();
  return (
    <>
      <SiteHeader active="week" strip={<HomeStrip status={data.status} />} />
      <MainShell>
        <Mission />
        <Hero data={data} />
        <KpiStrip kpis={data.kpis} />
        <RealNoiseDo data={data} />
        <EventsTable events={data.events} total={data.totalEvents} />
        <KevWeeks weeks={data.kevWeeks} />
        <Drivers d={data.drivers} />
        <Ransomware stats={data.ransomware} />
      </MainShell>
    </>
  );
}
