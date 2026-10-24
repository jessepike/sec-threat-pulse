import { schema } from "@/lib/db/client";
import type { Db } from "./db";

export interface AuditEntry {
  /** GitHub login of the admin. */
  actor: string;
  /** Dotted action name, e.g. "event.override". */
  action: string;
  target?: string | null;
  details?: Record<string, unknown>;
}

/** Builds the audit insert without running it, so callers can include it in a batch. */
export function auditInsert(db: Db, entry: AuditEntry) {
  return db.insert(schema.auditLog).values({
    actor: entry.actor,
    action: entry.action,
    target: entry.target ?? null,
    details: entry.details ?? null,
  });
}

/** Writes one audit_log row. Every mutating admin action calls this. */
export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await auditInsert(db, entry);
}
