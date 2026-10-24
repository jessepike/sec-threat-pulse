import { eq } from "drizzle-orm";
import { schema } from "@/lib/db/client";
import { VERDICTS, type Verdict } from "@/lib/ladder/types";
import { auditInsert } from "./audit";
import type { Db } from "./db";

export const REASON_MIN = 10;
export const REASON_MAX = 1000;

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export function isVerdict(v: unknown): v is Verdict {
  return typeof v === "string" && (VERDICTS as readonly string[]).includes(v);
}

export function validateReason(reason: unknown): Validation<string> {
  const r = typeof reason === "string" ? reason.trim() : "";
  if (!r) return { ok: false, error: "A reason is required." };
  if (r.length < REASON_MIN) return { ok: false, error: `The reason needs at least ${REASON_MIN} characters.` };
  if (r.length > REASON_MAX) return { ok: false, error: `The reason is limited to ${REASON_MAX} characters.` };
  return { ok: true, value: r };
}

export function validateOverride(input: {
  verdict: unknown;
  reason: unknown;
}): Validation<{ verdict: Verdict; reason: string }> {
  if (!isVerdict(input.verdict)) return { ok: false, error: "Choose a valid verdict." };
  const reason = validateReason(input.reason);
  if (!reason.ok) return reason;
  return { ok: true, value: { verdict: input.verdict, reason: reason.value } };
}

interface EventRef {
  id: string;
  ladder: Record<string, string>;
  rulesVersion: string;
  /** The verdict the rules computed, used when an override is cleared. */
  verdict: string;
}

/**
 * Sets an override. Updates the event and appends corrections, verdict_history and audit_log
 * rows in one batch.
 */
export async function applyOverride(
  db: Db,
  args: { actor: string; event: EventRef; verdict: Verdict; reason: string },
) {
  const { actor, event, verdict, reason } = args;
  await db.batch([
    db
      .update(schema.events)
      .set({ overrideVerdict: verdict, overrideReason: reason, updatedAt: new Date() })
      .where(eq(schema.events.id, event.id)),
    db.insert(schema.verdictHistory).values({
      eventId: event.id,
      verdict,
      ladder: event.ladder,
      rulesVersion: event.rulesVersion,
      reason: `Admin override: ${reason}`,
      actor: `admin:${actor}`,
    }),
    db.insert(schema.corrections).values({
      eventId: event.id,
      text: `Verdict set to ${verdict} by an editor. Reason: ${reason}`,
      actor: `admin:${actor}`,
    }),
    auditInsert(db, {
      actor,
      action: "event.override",
      target: event.id,
      details: { verdict, reason },
    }),
  ]);
}

/** Clears an override and records the return to the rules verdict. */
export async function clearOverride(
  db: Db,
  args: { actor: string; event: EventRef; reason: string },
) {
  const { actor, event, reason } = args;
  await db.batch([
    db
      .update(schema.events)
      .set({ overrideVerdict: null, overrideReason: null, updatedAt: new Date() })
      .where(eq(schema.events.id, event.id)),
    db.insert(schema.verdictHistory).values({
      eventId: event.id,
      verdict: event.verdict,
      ladder: event.ladder,
      rulesVersion: event.rulesVersion,
      reason: `Admin override cleared: ${reason}`,
      actor: `admin:${actor}`,
    }),
    db.insert(schema.corrections).values({
      eventId: event.id,
      text: `Verdict override removed by an editor. The rules verdict (${event.verdict}) applies. Reason: ${reason}`,
      actor: `admin:${actor}`,
    }),
    auditInsert(db, { actor, action: "event.override_clear", target: event.id, details: { reason } }),
  ]);
}
