import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { PlainStrip } from "./StatusStrip";
import { getMode } from "@/lib/data";

export function ProsePage({
  title,
  intro,
  children,
  badge = "PRE-LAUNCH PREVIEW",
  footer = "LAST UPDATED OCT 25, 2026 · PRE-LAUNCH PREVIEW, SUBJECT TO CHANGE",
}: {
  title: string;
  intro: string;
  children: ReactNode;
  /** Label above the title. Pass null for none. */
  badge?: string | null;
  footer?: string;
}) {
  return (
    <>
      <SiteHeader active="none" strip={<PlainStrip mode={getMode()} />} />
      <main id="main" className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 pb-20 pt-12 sm:px-6">
        <div className="flex flex-col gap-4">
          {badge ? <div className="w-fit rounded-sm border border-warn px-2.5 py-1 font-mono text-xs font-bold tracking-[0.1em] text-warn-text">{badge}</div> : null}
          <h1 className="m-0 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">{title}</h1>
          <p className="m-0 text-lg leading-[1.55] text-fg-2">{intro}</p>
        </div>
        <div className="flex flex-col gap-8 text-base leading-[1.65] text-fg-2 [&_a]:underline [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-[-0.01em] [&_h2]:text-fg [&_li]:pl-1 [&_p]:m-0 [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_strong]:text-fg [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
          {children}
        </div>
        <p className="m-0 border-t border-line pt-5 font-mono text-xs tracking-[0.06em] text-faint">{footer}</p>
      </main>
    </>
  );
}
