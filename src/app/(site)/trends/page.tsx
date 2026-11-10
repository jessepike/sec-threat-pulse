import type { Metadata } from "next";
import { Drivers, KpiStrip, Noise, Ransomware } from "@/components/home";
import { SiteHeader } from "@/components/SiteHeader";
import { PlainStrip } from "@/components/StatusStrip";
import { Eyebrow } from "@/components/ui";
import { getMode, getTrendsData } from "@/lib/data";
import { fmtDayYear } from "@/lib/data/format";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Trends from published reports",
  description: "How fast flaws are exploited, why, and which claims do not hold up. Figures come from published reports, each with its source and date.",
  path: "/trends",
});

/** Report figures change a few times a year. They live here so the home page only shows this week. */
export default function TrendsPage() {
  const d = getTrendsData();
  return (
    <>
      <SiteHeader active="none" strip={<PlainStrip mode={getMode()} />} />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 pb-[72px] pt-10 sm:gap-14 sm:px-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>{"// TRENDS"}</Eyebrow>
          <h1 className="m-0 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">Trends from published reports</h1>
          <p className="m-0 max-w-[760px] text-[17px] leading-[1.55] text-fg-2">
            These figures come from reports that other organizations publish a few times a year. They do not update with our scheduled runs. Each one shows its source and
            the date it was published.
          </p>
          {d.asOf && (
            <p className="m-0 w-fit rounded-sm border border-warn px-2.5 py-1 font-mono text-xs font-bold tracking-[0.1em] text-warn-text">
              NEWEST REPORT CITED: <time dateTime={d.asOf}>{fmtDayYear(d.asOf)}</time>
            </p>
          )}
        </div>
        <KpiStrip kpis={d.kpis} />
        <Drivers d={d.drivers} />
        <Noise noise={d.noise} />
        <Ransomware stats={d.ransomware} />
      </main>
    </>
  );
}
