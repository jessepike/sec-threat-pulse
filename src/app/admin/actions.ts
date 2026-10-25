"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { writeAudit, auditInsert } from "@/lib/admin/audit";
import { applyOverride, clearOverride, validateOverride, validateReason } from "@/lib/admin/override";
import { runSourceNow, SOURCE_ID } from "@/lib/admin/ingest-trigger";
import { parseFlags, parseRecipients, parseTheme } from "@/lib/admin/settings";
import { FEEDBACK_LABEL, createIssue, feedbackTitle } from "@/lib/admin/github";
import { EMPTY_NARRATIVE, parseNarrativeForm } from "@/lib/narrative/model";
import { getNarrative, saveNarrative, setNarrativeStatus } from "@/lib/narrative/store";
import { draftEnabled, draftModel, requestDraft } from "@/lib/narrative/draft";

// Server actions get Next's built-in Origin check (CSRF). Each one also re-checks the session.

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

function back(path: string, kind: "ok" | "error", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}`);
}

async function ctx(path: string) {
  const admin = await requireAdmin();
  const db = getDb();
  if (!db) back(path, "error", "Database not connected.");
  return { admin, db };
}

const EVENT_ID = /^[a-z0-9][a-z0-9._-]{0,120}$/i;

async function loadEvent(db: NonNullable<ReturnType<typeof getDb>>, id: string, path: string) {
  if (!EVENT_ID.test(id)) back(path, "error", "Invalid event id.");
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) back(path, "error", "Event not found.");
  return event;
}

// ---- Sources ----

export async function toggleSource(fd: FormData) {
  const path = "/admin/sources";
  const { admin, db } = await ctx(path);
  const id = str(fd, "id");
  if (!SOURCE_ID.test(id)) back(path, "error", "Invalid source id.");
  const enabled = str(fd, "enabled") === "true";
  await db.update(schema.sources).set({ enabled }).where(eq(schema.sources.id, id));
  await writeAudit(db, { actor: admin.login, action: "source.toggle", target: id, details: { enabled } });
  revalidatePath(path);
  back(path, "ok", `${id} ${enabled ? "enabled" : "disabled"}.`);
}

export async function setSourceInterval(fd: FormData) {
  const path = "/admin/sources";
  const { admin, db } = await ctx(path);
  const id = str(fd, "id");
  const minutes = Number(str(fd, "minutes"));
  if (!SOURCE_ID.test(id)) back(path, "error", "Invalid source id.");
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 10080) back(path, "error", "Interval must be 5 to 10080 minutes.");
  await db.update(schema.sources).set({ intervalMinutes: minutes }).where(eq(schema.sources.id, id));
  await writeAudit(db, { actor: admin.login, action: "source.interval", target: id, details: { minutes } });
  revalidatePath(path);
  back(path, "ok", `${id} interval set to ${minutes} minutes.`);
}

export async function runSourceAction(fd: FormData) {
  const path = str(fd, "from") === "sources" ? "/admin/sources" : "/admin/runs";
  const { admin, db } = await ctx(path);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (!host) back(path, "error", "Cannot work out the site address.");
  const id = str(fd, "id");
  const res = await runSourceNow(db, admin.login, `${proto}://${host}`, id);
  revalidatePath("/admin/runs");
  if (!res.ok) back(path, "error", res.error);
  back(path, "ok", `Run started for ${id}.`);
}

// ---- Events ----

export async function overrideVerdictAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  const v = validateOverride({ verdict: str(fd, "verdict"), reason: str(fd, "reason") });
  if (!v.ok) back(path, "error", v.error);
  const event = await loadEvent(db, id, path);
  await applyOverride(db, {
    actor: admin.login,
    event: { id, ladder: event.ladder, rulesVersion: event.rulesVersion, verdict: event.verdict },
    verdict: v.value.verdict,
    reason: v.value.reason,
  });
  revalidatePath("/admin", "layout");
  back(path, "ok", "Verdict override saved.");
}

export async function clearOverrideAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  const reason = validateReason(str(fd, "reason"));
  if (!reason.ok) back(path, "error", reason.error);
  const event = await loadEvent(db, id, path);
  if (!event.overrideVerdict) back(path, "error", "This event has no override.");
  await clearOverride(db, {
    actor: admin.login,
    event: { id, ladder: event.ladder, rulesVersion: event.rulesVersion, verdict: event.verdict },
    reason: reason.value,
  });
  revalidatePath("/admin", "layout");
  back(path, "ok", "Override cleared.");
}

export async function setHiddenAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  await loadEvent(db, id, path);
  const hidden = str(fd, "hidden") === "true";
  await db.batch([
    db.update(schema.events).set({ hidden, updatedAt: new Date() }).where(eq(schema.events.id, id)),
    auditInsert(db, { actor: admin.login, action: hidden ? "event.hide" : "event.unhide", target: id }),
  ]);
  revalidatePath("/admin", "layout");
  back(path, "ok", hidden ? "Event hidden from the public site." : "Event is visible again.");
}

export async function renameEventAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  const event = await loadEvent(db, id, path);
  const title = str(fd, "title").trim();
  if (title.length < 3 || title.length > 200) back(path, "error", "Title must be 3 to 200 characters.");
  await db.batch([
    db.update(schema.events).set({ title, updatedAt: new Date() }).where(eq(schema.events.id, id)),
    auditInsert(db, { actor: admin.login, action: "event.rename", target: id, details: { from: event.title, to: title } }),
  ]);
  revalidatePath("/admin", "layout");
  back(path, "ok", "Event renamed.");
}

/** Moves observations and CVEs from one event into another and hides the source event. */
export async function mergeEventsAction(fd: FormData) {
  const fromId = str(fd, "id");
  const intoId = str(fd, "into").trim();
  const path = `/admin/events/${encodeURIComponent(fromId)}`;
  const { admin, db } = await ctx(path);
  if (fromId === intoId) back(path, "error", "Choose a different event to merge into.");
  const from = await loadEvent(db, fromId, path);
  const into = await loadEvent(db, intoId, path);
  const cves = (await db.select().from(schema.eventCves).where(eq(schema.eventCves.eventId, fromId))).map((c) => c.cveId);
  const ops = [
    db.update(schema.observations).set({ eventId: intoId }).where(eq(schema.observations.eventId, fromId)),
    ...(cves.length
      ? [db.insert(schema.eventCves).values(cves.map((cveId) => ({ eventId: intoId, cveId }))).onConflictDoNothing()]
      : []),
    db.delete(schema.eventCves).where(eq(schema.eventCves.eventId, fromId)),
    db
      .update(schema.events)
      .set({ hidden: true, summary: `Merged into ${intoId}.`, updatedAt: new Date() })
      .where(eq(schema.events.id, fromId)),
    db.update(schema.events).set({ updatedAt: new Date() }).where(eq(schema.events.id, intoId)),
    auditInsert(db, {
      actor: admin.login,
      action: "event.merge",
      target: fromId,
      details: { into: intoId, fromTitle: from.title, intoTitle: into.title, cves },
    }),
  ] as const;
  await db.batch(ops as unknown as Parameters<typeof db.batch>[0]);
  revalidatePath("/admin", "layout");
  redirect(`/admin/events/${encodeURIComponent(intoId)}?ok=${encodeURIComponent(`Merged ${fromId} into this event. The event job recomputes its ladder.`)}`);
}

// ---- Corrections ----

export async function addCorrectionAction(fd: FormData) {
  const path = "/admin/corrections";
  const { admin, db } = await ctx(path);
  const text = str(fd, "text").trim();
  const eventId = str(fd, "eventId").trim();
  if (text.length < 10 || text.length > 2000) back(path, "error", "Write 10 to 2000 characters.");
  if (eventId) {
    if (!EVENT_ID.test(eventId)) back(path, "error", "Invalid event id.");
    const found = await db.select({ id: schema.events.id }).from(schema.events).where(inArray(schema.events.id, [eventId]));
    if (!found.length) back(path, "error", "Event not found.");
  }
  await db.batch([
    db.insert(schema.corrections).values({ eventId: eventId || null, text, actor: `admin:${admin.login}` }),
    auditInsert(db, { actor: admin.login, action: "correction.add", target: eventId || null, details: { text } }),
  ]);
  revalidatePath(path);
  back(path, "ok", "Correction added.");
}

// ---- Settings ----

export async function saveSettingsAction(fd: FormData) {
  const path = "/admin/settings";
  const { admin, db } = await ctx(path);
  const theme = parseTheme(str(fd, "theme"));
  if (!theme.ok) back(path, "error", theme.error);
  const flags = parseFlags(str(fd, "flags"));
  if (!flags.ok) back(path, "error", flags.error);
  const recipients = parseRecipients(str(fd, "recipients"));
  if (!recipients.ok) back(path, "error", recipients.error);
  const upsert = (key: string, value: unknown) =>
    db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
  await db.batch([
    upsert("default_theme", theme.value),
    upsert("feature_flags", flags.value),
    upsert("alert_recipients", recipients.value),
    auditInsert(db, {
      actor: admin.login,
      action: "settings.save",
      details: { theme: theme.value, flags: flags.value, recipients: recipients.value },
    }),
  ]);
  revalidatePath(path);
  back(path, "ok", "Settings saved.");
}

// ---- Roadmap ----

export async function addIdeaAction(fd: FormData) {
  const path = "/admin/roadmap";
  const admin = await requireAdmin();
  const token = process.env.GITHUB_TOKEN;
  if (!token) back(path, "error", "GITHUB_TOKEN is not set, so ideas cannot be created.");
  const title = str(fd, "title").trim();
  const body = str(fd, "body").trim();
  if (title.length < 3 || title.length > 140) back(path, "error", "Title must be 3 to 140 characters.");
  const res = await createIssue(token, { title, body: `${body}\n\nAdded from the admin console by ${admin.login}.`.trim() });
  if (!res.ok) back(path, "error", res.error);
  const db = getDb();
  if (db) await writeAudit(db, { actor: admin.login, action: "roadmap.add_idea", target: res.url, details: { title } });
  revalidatePath(path);
  back(path, "ok", "Idea added as a GitHub issue.");
}

/** Owner feedback on the roadmap, filed as a GitHub issue labeled "feedback" for the next agent session. */
export async function addFeedbackAction(fd: FormData) {
  const path = "/admin/roadmap";
  const admin = await requireAdmin();
  const token = process.env.GITHUB_TOKEN;
  if (!token) back(path, "error", "GITHUB_TOKEN is not set, so feedback cannot be saved.");
  const topic = str(fd, "topic").trim().slice(0, 60) || "General";
  const text = str(fd, "text").trim();
  if (text.length < 3 || text.length > 5000) back(path, "error", "Feedback must be 3 to 5,000 characters.");
  const body = `${text}\n\n---\nTopic: ${topic}\nFrom the admin roadmap by ${admin.login}. Agents: act on this, reply here with what changed or what you need, and close it when done.`;
  const res = await createIssue(token, { title: feedbackTitle(topic, text), body, labels: [FEEDBACK_LABEL] });
  if (!res.ok) back(path, "error", res.error);
  const db = getDb();
  if (db) await writeAudit(db, { actor: admin.login, action: "roadmap.add_feedback", target: res.url, details: { topic } });
  revalidatePath(path);
  back(path, "ok", "Feedback saved. The next agent session picks it up.");
}

// ---- Narratives ----

function refreshPublic(id: string) {
  updateTag("stp");
  revalidatePath("/");
  revalidatePath(`/events/${id}`);
}

/** Save draft or publish, chosen by the submit button's value. A human edit marks the source as human. */
export async function saveNarrativeAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  const parsed = parseNarrativeForm(fd);
  if (!parsed.ok) back(path, "error", parsed.error);
  await loadEvent(db, id, path);
  const publish = str(fd, "intent") === "publish";
  const existing = await getNarrative(db, id);
  // Keep the ai_draft label when the text is unchanged from the AI draft; any edit makes it human.
  const unchanged =
    existing?.source === "ai_draft" &&
    JSON.stringify({ ...EMPTY_NARRATIVE, ...parsed.value }) ===
      JSON.stringify({
        businessExposure: existing.businessExposure ?? "",
        whyAct: existing.whyAct ?? "",
        fix: existing.fix ?? "",
        askYourTeam: existing.askYourTeam ?? "",
        roles: existing.roles,
        claimChecks: existing.claimChecks,
      });
  await saveNarrative(db, {
    actor: admin.login,
    eventId: id,
    input: parsed.value,
    source: unchanged ? "ai_draft" : "human",
    status: publish ? "published" : "draft",
    action: publish ? "narrative.publish" : "narrative.save_draft",
  });
  refreshPublic(id);
  back(path, "ok", publish ? "Narrative published." : "Draft saved.");
}

export async function unpublishNarrativeAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  await loadEvent(db, id, path);
  if (!(await getNarrative(db, id))) back(path, "error", "There is no narrative to unpublish.");
  await setNarrativeStatus(db, { actor: admin.login, eventId: id, status: "draft" });
  refreshPublic(id);
  back(path, "ok", "Narrative unpublished.");
}

/** Asks the model for a draft and saves it as an unpublished ai_draft. Never publishes. */
export async function draftNarrativeAction(fd: FormData) {
  const id = str(fd, "id");
  const path = `/admin/events/${encodeURIComponent(id)}`;
  const { admin, db } = await ctx(path);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || !draftEnabled()) back(path, "error", "ANTHROPIC_API_KEY is not set.");
  const event = await loadEvent(db, id, path);
  const existing = await getNarrative(db, id);
  if (existing?.status === "published") back(path, "error", "Unpublish the narrative before drafting a new one.");
  const [cves, obs] = await Promise.all([
    db.select().from(schema.eventCves).where(eq(schema.eventCves.eventId, id)),
    db.select({ title: schema.observations.title, url: schema.observations.url, kind: schema.observations.kind }).from(schema.observations).where(eq(schema.observations.eventId, id)).limit(25),
  ]);
  const res = await requestDraft(
    {
      title: event.title,
      vendor: event.vendor,
      product: event.product,
      ladder: event.ladder,
      verdict: event.overrideVerdict ?? event.verdict,
      verdictReason: event.overrideReason ?? event.verdictReason,
      cves: cves.map((c) => c.cveId).sort(),
      observations: obs,
    },
    { apiKey: apiKey!, model: draftModel() },
  );
  if (!res.ok) back(path, "error", res.error);
  await saveNarrative(db, { actor: admin.login, eventId: id, input: res.value, source: "ai_draft", status: "draft", action: "narrative.ai_draft" });
  back(path, "ok", "AI draft saved. Review it, then publish.");
}
