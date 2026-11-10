import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventList } from "@/components/EventList";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeStrip } from "@/components/StatusStrip";
import { Eyebrow, LadderKey, VERDICT_STYLE } from "@/components/ui";
import { getVendor } from "@/lib/data";
import { pageMeta } from "@/lib/site";

export const revalidate = 1800;

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const data = await getVendor(key);
  if (!data) return pageMeta({ title: "Vendor not found", description: "No tracked event names this vendor.", path: `/vendors/${key}` });
  const v = data.vendor;
  return pageMeta({
    title: `${v.name} flaws`,
    description: `${v.name}: ${v.actNow} Act now and ${v.watch} Watch events tracked by Security Threat Pulse, with evidence and the first step for each.`,
    path: `/vendors/${v.key}`,
  });
}

export default async function VendorPage({ params }: Props) {
  const { key } = await params;
  const data = await getVendor(key);
  if (!data) notFound();
  const { vendor: v, rows, status } = data;
  return (
    <>
      <SiteHeader active="vendors" strip={<HomeStrip status={status} />} />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-[72px] pt-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <Link href="/vendors" className="self-start py-3 font-mono text-[13px] tracking-[0.06em] text-muted no-underline hover:text-fg">← ALL VENDORS</Link>
          <Eyebrow>{"// VENDOR"}</Eyebrow>
          <h1 className="m-0 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">{v.name}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm tracking-[0.06em]">
            <span className={VERDICT_STYLE.act_now.text}>{v.actNow} ACT NOW</span>
            <span className={VERDICT_STYLE.watch.text}>{v.watch} WATCH</span>
            {v.low > 0 && <span className={VERDICT_STYLE.low.text}>{v.low} LOW</span>}
          </div>
        </div>

        <section aria-labelledby="prod-h" className="flex flex-col gap-3">
          <h2 id="prod-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">PRODUCTS NAMED · {v.products.length}</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {v.products.map((p) => (
              <li key={p.slug}>
                <Link href={`/events?product=${encodeURIComponent(p.slug)}`} className="inline-block rounded-[3px] border border-line-strong px-3 py-3 font-mono text-[13px] text-fg no-underline hover:border-accent">
                  {p.label}
                  {p.embedded ? " (ships the component)" : ""} · {p.events}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ev-h" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="ev-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">
              EVENTS · {v.total}{rows.length < v.total ? ` · SHOWING THE TOP ${rows.length}` : ""}
            </h2>
            <LadderKey />
          </div>
          <EventList events={rows} label={`${v.name} events with evidence ladder and verdict`} />
        </section>
        <p className="m-0 font-mono text-[13px] text-muted">
          AGENTS: <a href={`/api/v1/check-stack?products=${encodeURIComponent(v.key)}`}>/api/v1/check-stack?products={v.key}</a>
        </p>
      </main>
    </>
  );
}
