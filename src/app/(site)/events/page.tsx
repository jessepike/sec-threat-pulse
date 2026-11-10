import type { Metadata } from "next";
import Link from "next/link";
import { EventList } from "@/components/EventList";
import { YourVendors } from "@/components/YourVendors";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeStrip } from "@/components/StatusStrip";
import { Eyebrow, LadderKey } from "@/components/ui";
import { getEventsIndex, parsePage, parseProductFilter, parseVerdictFilter, type VerdictFilter } from "@/lib/data";
import { eventsHref } from "@/lib/data/listing";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "All events",
  description: "Every event Security Threat Pulse tracks, with its evidence ladder and verdict. Filter by verdict.",
  path: "/events",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FILTERS: { key: VerdictFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "act_now", label: "ACT NOW" },
  { key: "watch", label: "WATCH" },
  { key: "low", label: "LOW" },
];

export default async function EventsIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const product = parseProductFilter(sp.product);
  const data = await getEventsIndex(parseVerdictFilter(sp.verdict), parsePage(sp.page), product);
  const { filter, page, pages, total, pageSize, counts } = data;
  const productLabel = product ? (data.rows.flatMap((r) => r.products ?? []).find((p) => p.slug === product)?.label ?? product) : undefined;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const count = (k: VerdictFilter) => (k === "all" ? counts.total : counts[k]);
  const filterLabel = FILTERS.find((f) => f.key === filter)!.label;
  return (
    <>
      <SiteHeader active="events" strip={<HomeStrip status={data.status} />} />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-[72px] pt-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>{"// ALL EVENTS"}</Eyebrow>
          <h1 className="m-0 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">All events</h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-[1.55] text-fg-2">
            Every event we track, in rank order: verdict first, then the strongest and newest evidence. Open an event for what it is and what to do.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Filter by verdict" className="flex flex-wrap gap-2 font-mono text-[13px] tracking-[0.06em]">
            {FILTERS.filter((f) => f.key !== "low" || counts.low > 0 || filter === "low").map((f) => (
              <Link
                key={f.key}
                href={eventsHref(f.key, 1, product)}
                aria-current={filter === f.key ? "page" : undefined}
                className={`rounded-[3px] border px-4 py-3 no-underline ${filter === f.key ? "border-accent bg-surface text-fg" : "border-line-strong text-muted hover:text-fg"}`}
              >
                {f.label} · {count(f.key)}
              </Link>
            ))}
          </nav>
          <LadderKey />
        </div>

        {product && (
          <div className="flex flex-wrap items-center gap-3 rounded border border-accent bg-surface px-4 py-3 font-mono text-[13px] tracking-[0.06em]">
            <span className="text-muted">PRODUCT</span>
            <span className="font-bold">{productLabel}</span>
            <Link href={eventsHref(filter, 1)} className="text-muted no-underline hover:text-fg">× CLEAR</Link>
          </div>
        )}
        <YourVendors />

        <section aria-labelledby="list-h" className="flex flex-col gap-4">
          <h2 id="list-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">
            {total === 0 ? `NO ${filter === "all" ? "" : `${filterLabel} `}EVENTS` : `${filter === "all" ? "ALL" : filterLabel} EVENTS · SHOWING ${from} TO ${to} OF ${total}`}
          </h2>
          <EventList
            events={data.rows}
            label={`${filter === "all" ? "All" : filterLabel.charAt(0) + filterLabel.slice(1).toLowerCase()} events with evidence ladder and verdict`}
            empty={product ? "No tracked event names this product." : filter === "all" ? "No events are tracked yet." : "No events have this verdict right now."}
          />
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-4 font-mono text-[13px] tracking-[0.06em]">
              {page > 1 ? (
                <Link href={eventsHref(filter, page - 1, product)} rel="prev" className="rounded-[3px] border border-line-strong px-4 py-2.5 no-underline">← PREVIOUS</Link>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="text-muted">PAGE {page} OF {pages}</span>
              {page < pages ? (
                <Link href={eventsHref(filter, page + 1, product)} rel="next" className="rounded-[3px] border border-line-strong px-4 py-2.5 no-underline">NEXT →</Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          )}
        </section>
      </main>
    </>
  );
}
