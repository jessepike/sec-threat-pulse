import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeStrip } from "@/components/StatusStrip";
import { Eyebrow, VERDICT_STYLE } from "@/components/ui";
import { getVendors } from "@/lib/data";
import { parseVendorStack, stackTotals, type VendorSummary } from "@/lib/data/vendors";
import { pageMeta } from "@/lib/site";

export const revalidate = 1800;
export const metadata: Metadata = pageMeta({
  title: "Vendors",
  description: "Every vendor named by a tracked event, with how many of its flaws are rated Act now or Watch. Add ?stack= to see only the vendors you use.",
  path: "/vendors",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function VendorCard({ v }: { v: VendorSummary }) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded border border-line bg-surface p-5 [overflow-wrap:anywhere]">
      <Link href={`/vendors/${v.key}`} className="py-1 font-display text-lg font-semibold leading-snug text-fg no-underline hover:text-accent">
        {v.name}
      </Link>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[13px] tracking-[0.06em]">
        {v.actNow > 0 && <span className={VERDICT_STYLE.act_now.text}>{v.actNow} ACT NOW</span>}
        {v.watch > 0 && <span className={VERDICT_STYLE.watch.text}>{v.watch} WATCH</span>}
        {v.actNow === 0 && v.watch === 0 && <span className="text-muted">{v.total} LOW</span>}
      </div>
      <p className="m-0 text-sm leading-normal text-muted">{v.products.slice(0, 3).map((p) => p.label).join(", ")}{v.products.length > 3 ? ` and ${v.products.length - 3} more` : ""}</p>
    </li>
  );
}

export default async function VendorsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const stack = parseVendorStack(sp.stack);
  const { status, vendors } = await getVendors();
  // "paloalto" finds "paloaltonetworks": a key of 4 or more letters also matches the start of a vendor key.
  const hit = (k: string, v: VendorSummary) => v.key === k || (k.length >= 4 && v.key.startsWith(k));
  const mine = vendors.filter((v) => stack.some((k) => hit(k, v)));
  const missing = stack.filter((k) => !vendors.some((v) => hit(k, v)));
  const totals = stackTotals(mine);
  const flagged = vendors.filter((v) => v.actNow + v.watch > 0);
  const rest = vendors.filter((v) => v.actNow + v.watch === 0);
  return (
    <>
      <SiteHeader active="vendors" strip={<HomeStrip status={status} />} />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-[72px] pt-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>{"// VENDORS"}</Eyebrow>
          <h1 className="m-0 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">Vendors</h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-[1.55] text-fg-2">
            Every vendor named by a tracked event, most Act now first. To keep a list of the vendors you use, add them to the address, for example{" "}
            <Link href="/vendors?stack=microsoft,fortinet,ivanti">/vendors?stack=microsoft,fortinet,ivanti</Link>, and bookmark it.
          </p>
        </div>

        {stack.length > 0 && (
          <section aria-labelledby="mine-h" className="flex flex-col gap-4">
            <h2 id="mine-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">
              YOUR STACK · {totals.actNow} ACT NOW · {totals.watch} WATCH
            </h2>
            {mine.length > 0 && <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 p-0">{mine.map((v) => <VendorCard key={v.key} v={v} />)}</ul>}
            {missing.length > 0 && <p className="m-0 text-[15px] text-muted">No tracked event names {missing.join(", ")}.</p>}
          </section>
        )}

        <section aria-labelledby="all-h" className="flex flex-col gap-4">
          <h2 id="all-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">ACT NOW OR WATCH · {flagged.length} VENDORS</h2>
          {flagged.length === 0 ? <p className="m-0 text-[15px] text-muted">No vendor has an Act now or Watch event right now.</p> : <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 p-0">{flagged.map((v) => <VendorCard key={v.key} v={v} />)}</ul>}
        </section>
        {rest.length > 0 && (
          <section aria-labelledby="rest-h" className="flex flex-col gap-3">
            <h2 id="rest-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">LOW ONLY · {rest.length} VENDORS</h2>
            <p className="m-0 text-[15px] leading-relaxed">{rest.map((v, i) => <span key={v.key}>{i > 0 && ", "}<Link href={`/vendors/${v.key}`}>{v.name}</Link></span>)}</p>
          </section>
        )}
      </main>
    </>
  );
}
