import { describe, expect, it, vi } from "vitest";
import { ownerItems, parseBacklog, sectionLabel } from "../backlog";
import { parseFlags, parseRecipients } from "../settings";
import { triggerIngest } from "../ingest-trigger";

const MD = `# Backlog

## Phase 0: Foundations · Gate: live site deployed

- [x] Repo
- [ ] Vercel project,
      Neon database

## Phase 1: Data spine · Gate: 7 days fresh

- [ ] Adapters

## Permissions and partnerships (owner sends)

- [ ] ransomware.live approval

## Later phases

3 News and claims · 4 Machine layer (API, RSS) · 5 Audience views · 6 Launch
`;

describe("parseBacklog", () => {
  const p = parseBacklog(MD);
  it("reads phases, gates and items", () => {
    expect(p.map((x) => x.number)).toEqual([0, 1, 3, 4, 5, 6, null]);
    expect(p[0]).toMatchObject({ name: "Foundations", gate: "live site deployed" });
    expect(p[0].items).toEqual([
      { done: true, text: "Repo" },
      { done: false, text: "Vercel project, Neon database" },
    ]);
  });
  it("reads waves and other checklists, and finds what waits on the owner", () => {
    const w = parseBacklog(`## Phase 0: Foundations · Gate: live

- [x] Repo

## Research and plan (Nov 7, 2026)

- [x] Value brief

## Wave 0: Durable floor (started Nov 8, 2026) · Gate: 7 days fresh

- [x] Status page
- [ ] Probe drill (the routine gets 403; owner runs it from the Actions tab)

## Wave 4: Launch (started Nov 8, 2026) · Jesse decides each outward step · Steps in \`docs/launch\`

- [ ] Owner: turn indexing on
- [ ] More sources

## Notes with no checklist

Text.
`);
    expect(w.map(sectionLabel)).toEqual(["Phase 0: Foundations", "Research and plan (Nov 7, 2026)", "Wave 0: Durable floor (started Nov 8, 2026)", "Wave 4: Launch (started Nov 8, 2026)"]);
    expect(w[2]).toMatchObject({ key: "wave-0", wave: 0, gate: "7 days fresh" });
    expect(w[3].gate).toBeNull();
    expect(ownerItems(w)).toEqual([
      { section: "Wave 0: Durable floor (started Nov 8, 2026)", text: "Probe drill (the routine gets 403; owner runs it from the Actions tab)" },
      { section: "Wave 4: Launch (started Nov 8, 2026)", text: "Owner: turn indexing on" },
    ]);
  });
  it("reads later phases", () => {
    expect(p.find((x) => x.number === 4)?.name).toBe("Machine layer (API, RSS)");
  });
});

describe("settings parsing", () => {
  it("parses flags", () => {
    expect(parseFlags("a_b\nc=false\n")).toEqual({ ok: true, value: { a_b: true, c: false } });
    expect(parseFlags("Bad Flag").ok).toBe(false);
    expect(parseFlags("x=maybe").ok).toBe(false);
  });
  it("parses recipients", () => {
    expect(parseRecipients("A@x.com, a@x.com\nb@y.org")).toEqual({ ok: true, value: ["a@x.com", "b@y.org"] });
    expect(parseRecipients("nope").ok).toBe(false);
  });
});

describe("triggerIngest", () => {
  it("calls the cron route with the secret", async () => {
    const f = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const r = await triggerIngest("https://x.test", "cisa-kev", { secret: "s", fetchImpl: f as unknown as typeof fetch });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledWith("https://x.test/api/cron/ingest?only=cisa-kev&force=1", expect.objectContaining({ headers: { authorization: "Bearer s" } }));
  });
  it("rejects bad ids and missing secret", async () => {
    expect((await triggerIngest("https://x.test", "../x", { secret: "s" })).ok).toBe(false);
    expect((await triggerIngest("https://x.test", "ok", { secret: "" })).ok).toBe(false);
  });
});
