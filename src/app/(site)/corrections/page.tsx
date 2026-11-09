import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose";
import { getCorrections } from "@/lib/data";
import { fmtDayYear } from "@/lib/data/format";
import { pageMeta } from "@/lib/site";

export const revalidate = 1800;

export const metadata: Metadata = pageMeta({
  title: "Corrections",
  description: "Every correction to a verdict, ladder or published text on Security Threat Pulse, newest first.",
  path: "/corrections",
  extra: { alternates: { types: { "application/rss+xml": "/corrections/feed.xml" } } },
});

export default async function CorrectionsPage() {
  const { rows } = await getCorrections();
  return (
    <ProsePage
      title="Corrections"
      intro="When we change a verdict or fix a mistake, we log it here with the date and the reason. Entries are never edited or removed."
      badge={null}
      footer="NEWEST FIRST"
    >
      <p>
        See something wrong? Write to <a href="mailto:jp@jessepike.dev">jp@jessepike.dev</a>. You can also follow this log as an{" "}
        <a href="/corrections/feed.xml">RSS feed</a>. How verdicts are set is in the <Link href="/methodology">methodology</Link>.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-sm border border-line bg-surface px-4 py-5 text-fg">No corrections yet.</p>
      ) : (
        <ol aria-label="Corrections, newest first" className="!m-0 !flex !list-none !flex-col !gap-0 !p-0">
          {rows.map((c) => (
            <li key={c.id} id={`c-${c.id}`} className="flex scroll-mt-4 flex-col gap-2 border-t border-line py-5 first:border-t-0 first:pt-0 !pl-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tracking-[0.06em] text-muted">
                <time dateTime={c.at}>{fmtDayYear(c.at)}</time>
                {c.eventHref ? (
                  <Link href={c.eventHref}>{c.eventTitle}</Link>
                ) : (
                  <span>{c.eventId ? "EVENT NO LONGER SHOWN" : "ALL EVENTS"}</span>
                )}
              </div>
              <p className="!whitespace-pre-line text-fg">{c.text}</p>
            </li>
          ))}
        </ol>
      )}
    </ProsePage>
  );
}
