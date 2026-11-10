import Link from "next/link";
import { notFound } from "next/navigation";
import { AskYourTeam, ClaimCheck, EventHero, Roles, Summary } from "@/components/event";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { dbEvent } from "@/lib/data/db";
import { withNarrative } from "@/lib/narrative/preview";
import { getNarrative } from "@/lib/narrative/store";
import { Empty, NoDb, PageHead, fmt } from "../../../../_components/ui";

export const metadata = { title: "Preview" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

/** The saved write-up, published or not, laid out with the public page's own parts. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const back = `/admin/events/${encodeURIComponent(id)}`;
  const db = getDb();
  if (!db) {
    return (
      <>
        <PageHead title="Preview" />
        <NoDb />
      </>
    );
  }
  const [view, n] = await Promise.all([dbEvent(id), getNarrative(db, id)]);
  if (!view && !n) notFound();
  const head = (
    <PageHead title="Preview" sub={n ? `The write-up as saved by ${n.updatedBy} at ${fmt(n.updatedAt)}. Status: ${n.status}.` : "No write-up is saved for this event."}>
      <Link href={back} className="adm-btn">Back to the editor</Link>
    </PageHead>
  );
  if (!view) {
    return (
      <>
        {head}
        <div className="adm-card"><Empty>This event is hidden, so it has no public page to preview. Unhide it first.</Empty></div>
      </>
    );
  }
  const e = n ? withNarrative(view, n, n.status === "published" ? n : null) : view;
  return (
    <>
      {head}
      <p className="adm-small adm-muted">
        These are the parts of the public page the write-up changes. Text you have typed and not saved is not here: save the draft, then open the preview.
      </p>
      <div className="adm-pub">
        <EventHero e={e} />
        <Summary e={e} />
        <AskYourTeam e={e} />
        <ClaimCheck e={e} />
        <Roles e={e} />
      </div>
    </>
  );
}
