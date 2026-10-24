import { describe, expect, it, vi } from "vitest";
import { parseBacklog } from "../backlog";
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
    expect(f).toHaveBeenCalledWith("https://x.test/api/cron/ingest?source=cisa-kev", expect.objectContaining({ headers: { authorization: "Bearer s" } }));
  });
  it("rejects bad ids and missing secret", async () => {
    expect((await triggerIngest("https://x.test", "../x", { secret: "s" })).ok).toBe(false);
    expect((await triggerIngest("https://x.test", "ok", { secret: "" })).ok).toBe(false);
  });
});
