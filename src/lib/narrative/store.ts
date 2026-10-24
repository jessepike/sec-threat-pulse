import { eq } from "drizzle-orm";
import { schema } from "@/lib/db/client";
import { auditInsert } from "@/lib/admin/audit";
import type { Db } from "@/lib/admin/db";
import type { NarrativeInput } from "./model";

export type NarrativeRecord = typeof schema.eventNarratives.$inferSelect;

export async function getNarrative(db: Db, eventId: string): Promise<NarrativeRecord | null> {
  const [row] = await db.select().from(schema.eventNarratives).where(eq(schema.eventNarratives.eventId, eventId));
  return row ?? null;
}

type Source = "human" | "ai_draft";
type Status = "draft" | "published";

/** Upserts the narrative and appends an audit row in one batch. */
export async function saveNarrative(
  db: Db,
  args: { actor: string; eventId: string; input: NarrativeInput; source: Source; status: Status; action: string },
) {
  const { actor, eventId, input, source, status, action } = args;
  const values = {
    businessExposure: input.businessExposure,
    whyAct: input.whyAct,
    fix: input.fix,
    askYourTeam: input.askYourTeam,
    roles: input.roles,
    claimChecks: input.claimChecks,
    source,
    status,
    updatedBy: actor,
    updatedAt: new Date(),
  };
  await db.batch([
    db
      .insert(schema.eventNarratives)
      .values({ eventId, ...values })
      .onConflictDoUpdate({ target: schema.eventNarratives.eventId, set: values }),
    auditInsert(db, { actor, action, target: eventId, details: { source, status } }),
  ]);
}

/** Changes only the status (publish or unpublish). */
export async function setNarrativeStatus(db: Db, args: { actor: string; eventId: string; status: Status }) {
  const { actor, eventId, status } = args;
  await db.batch([
    db.update(schema.eventNarratives).set({ status, updatedBy: actor, updatedAt: new Date() }).where(eq(schema.eventNarratives.eventId, eventId)),
    auditInsert(db, { actor, action: status === "published" ? "narrative.publish" : "narrative.unpublish", target: eventId, details: { status } }),
  ]);
}
