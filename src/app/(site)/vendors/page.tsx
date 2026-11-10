import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeStrip } from "@/components/StatusStrip";
import { Eyebrow } from "@/components/ui";
import { VendorPicker, type PickerVendor } from "@/components/VendorPicker";
import { getVendors } from "@/lib/data";
import { parseVendorStack } from "@/lib/data/vendors";
import { pageMeta } from "@/lib/site";

export const revalidate = 1800;
export const metadata: Metadata = pageMeta({
  title: "Vendors",
  description: "Every vendor named by a tracked event, with how many of its flaws are rated Act now or Watch. Tick the vendors you use to keep your own list in the page address.",
  path: "/vendors",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function VendorsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const stack = parseVendorStack(sp.stack);
  const { status, vendors } = await getVendors();
  const slim: PickerVendor[] = vendors.map((v) => ({
    key: v.key,
    name: v.name,
    actNow: v.actNow,
    watch: v.watch,
    total: v.total,
    products: v.products.slice(0, 3).map((p) => p.label),
    more: Math.max(0, v.products.length - 3),
    search: v.products.map((p) => p.label.toLowerCase()).join("\n"),
    actNowIds: v.actNowIds,
    watchIds: v.watchIds,
  }));
  return (
    <>
      <SiteHeader active="vendors" strip={<HomeStrip status={status} />} />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-[72px] pt-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>{"// VENDORS"}</Eyebrow>
          <h1 className="m-0 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">Vendors</h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-[1.55] text-fg-2">
            Every vendor named by a tracked event, most Act now first. Tick the ones you use to build your own list.
          </p>
        </div>
        <VendorPicker vendors={slim} initial={stack} />
      </main>
    </>
  );
}
