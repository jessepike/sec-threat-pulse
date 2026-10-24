import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PlainStrip } from "@/components/StatusStrip";
import { getMode } from "@/lib/data";

export default function NotFound() {
  return (
    <>
      <SiteHeader active="none" strip={<PlainStrip mode={getMode()} />} />
      <main id="main" className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-20 sm:px-6">
        <h1 className="m-0 font-display text-4xl font-bold">Page not found</h1>
        <p className="m-0 text-base leading-[1.6] text-fg-2">
          We have no event or page at this address. <Link href="/">Go to this week.</Link>
        </p>
      </main>
    </>
  );
}
